"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PdfLightPreview, PdfPreviewSkeleton } from "@/components/PdfLightPreview";
import { RequireAuth } from "@/components/RequireAuth";
import { ChatHeader } from "@/components/ChatHeader";
import {
  api,
  createBookmark,
  deleteChatSession,
  deleteBookmarkByMessage,
  downloadBlob,
  editChatMessage,
  fetchDocumentFile,
  listBookmarkedMessageIds,
  renameChatSession,
  type CitationSource,
  type ChatMessage,
  type ChatSendResponse,
  type ChatSession,
  type Document,
  type SummaryResponse,
} from "@/lib/api";

export default function DocumentChatPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<Document | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(`chat_session_${id}`) ?? null;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editedMessageIds, setEditedMessageIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkPendingIds, setBookmarkPendingIds] = useState<Set<string>>(new Set());
  const [activeCitation, setActiveCitation] = useState<{
    pageNumber: number;
    snippet: string;
    timestamp: number;
  } | null>(null);
  const [messageSources, setMessageSources] = useState<Record<string, CitationSource[]>>({});

  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [textFilePreview, setTextFilePreview] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"pdf" | "text" | "office" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDocId, setPreviewDocId] = useState<string>(id);
  const [showPreview, setShowPreview] = useState(false);
  const previewUrlRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const documentIds = useMemo(() => [id], [id]);

  const selectedDocs = useMemo(() => (doc ? [doc] : [] as Document[]), [doc]);

  const previewDoc = useMemo(() => {
    return selectedDocs.find((item) => item.id === previewDocId) ?? doc;
  }, [doc, previewDocId, selectedDocs]);

  const previewDocIndex = useMemo(() => {
    if (!previewDoc) return 0;
    const index = selectedDocs.findIndex((item) => item.id === previewDoc.id);
    return index >= 0 ? index : 0;
  }, [previewDoc, selectedDocs]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [d, sess] = await Promise.all([
        api<Document>(`/documents/${id}`),
        api<ChatSession[]>(`/chat/sessions?document_id=${encodeURIComponent(id)}`),
      ]);
      setDoc(d);
      setSessions(sess);
      // Only clear sessionId if the saved session was deleted from the server.
      // Don't set it redundantly — the lazy initializer already read the correct value.
      const saved = localStorage.getItem(`chat_session_${id}`);
      if (saved && !sess.some((s) => s.id === saved)) {
        localStorage.removeItem(`chat_session_${id}`);
        setSessionId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPreviewDocId((current) => {
      const exists = selectedDocs.some((item) => item.id === current);
      return exists ? current : id;
    });
  }, [id, selectedDocs]);

  useEffect(() => {
    if (!previewDoc) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPdfData(null);
    setFileBlobUrl(null);
    setTextFilePreview(null);
    setPreviewKind(null);
    setPreviewError(null);

    let cancelled = false;

    (async () => {
      setPreviewLoading(true);
      try {
        const blob = await fetchDocumentFile(previewDoc.id);
        const mt = previewDoc.mime_type.toLowerCase();
        if (mt.includes("pdf")) {
          const buffer = await blob.arrayBuffer();
          if (!cancelled) {
            setPdfData(new Uint8Array(buffer));
            setPreviewKind("pdf");
          }
        } else if (mt.startsWith("text/")) {
          const text = await blob.text();
          if (!cancelled) {
            setTextFilePreview(text);
            setPreviewKind("text");
          }
        } else if (mt.includes("wordprocessingml") || mt.includes("msword")) {
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          if (!cancelled) {
            setFileBlobUrl(url);
            setPreviewKind("office");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : "Could not load file for preview");
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [previewDoc]);



  async function loadMessages(sid: string) {
    const msgs = await api<ChatMessage[]>(`/chat/sessions/${sid}/messages`);
    setMessages(msgs);
  }

  async function loadBookmarkedIds(sid?: string) {
    const ids = await listBookmarkedMessageIds(sid);
    setBookmarkedIds(new Set(ids));
  }

  useEffect(() => {
    if (!sessionId) {
      localStorage.removeItem(`chat_session_${id}`);
      setMessages([]);
      setBookmarkedIds(new Set());
      setEditingMessageId(null);
      setEditingDraft("");
      return;
    }
    localStorage.setItem(`chat_session_${id}`, sessionId);
    Promise.all([loadMessages(sessionId), loadBookmarkedIds(sessionId)]).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load messages")
    );
  }, [sessionId, id]);

  async function onToggleBookmark(message: ChatMessage) {
    if (message.id.startsWith("optimistic-")) return;
    if (bookmarkPendingIds.has(message.id)) return;
    const wasBookmarked = bookmarkedIds.has(message.id);
    setBookmarkPendingIds((prev) => new Set(prev).add(message.id));
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (wasBookmarked) next.delete(message.id);
      else next.add(message.id);
      return next;
    });
    try {
      if (wasBookmarked) {
        await deleteBookmarkByMessage(message.id);
      } else {
        await createBookmark(message.id);
      }
    } catch (err) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(message.id);
        else next.delete(message.id);
        return next;
      });
      setError(err instanceof Error ? err.message : "Bookmark update failed");
    } finally {
      setBookmarkPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }

  // Auto-scroll to bottom whenever messages list or thinking state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // 1. Show user message instantly and clear input
    const optimisticUserMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput("");
    setSending(true);
    setThinking(true);
    setError(null);

    try {
      const body: {
        document_ids: string[];
        message: string;
        session_id?: string;
      } = { document_ids: documentIds, message: text };
      if (sessionId) body.session_id = sessionId;

      const res = await api<ChatSendResponse>("/chat/messages", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setThinking(false);
      setSessionId(res.session_id);
      // Replace optimistic message list with authoritative messages from server
      await loadMessages(res.session_id);
      setMessageSources((prev) => ({
        ...prev,
        [res.assistant_message.id]: Array.isArray(res.assistant_sources) ? res.assistant_sources : [],
      }));
      const sess = await api<ChatSession[]>(`/chat/sessions?document_id=${encodeURIComponent(id)}`);
      setSessions(sess);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : "Send failed");
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setSending(false);
    }
  }

  async function onSaveInlineEdit(messageId: string) {
    if (!editingDraft.trim()) return;
    setSending(true);
    setThinking(true);
    setError(null);
    try {
      const [res] = await Promise.all([
        editChatMessage(messageId, editingDraft.trim()),
        new Promise((resolve) => window.setTimeout(resolve, 1200)),
      ]);
      setThinking(false);
      setSessionId(res.session_id);
      setEditingMessageId(null);
      setEditingDraft("");
      setEditedMessageIds((prev) => new Set(prev).add(res.user_message.id));
      setMessageSources((prev) => ({
        ...prev,
        [res.assistant_message.id]: Array.isArray(res.assistant_sources) ? res.assistant_sources : [],
      }));
      await loadMessages(res.session_id);
      const sess = await api<ChatSession[]>(`/chat/sessions?document_id=${encodeURIComponent(id)}`);
      setSessions(sess);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setSending(false);
    }
  }

  async function onSummary() {
    setError(null);
    setSummaryLoading(true);
    try {
      const [s] = await Promise.all([
        api<SummaryResponse>(`/documents/${id}/summary`, { method: "POST" }),
        new Promise((resolve) => window.setTimeout(resolve, 1000)),
      ]);
      setSummary(s.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed");
    } finally {
      setSummaryLoading(false);
    }
  }

  function showPreviousPreviewDoc() {
    if (selectedDocs.length <= 1) return;
    const nextIndex = previewDocIndex === 0 ? selectedDocs.length - 1 : previewDocIndex - 1;
    setPreviewDocId(selectedDocs[nextIndex].id);
  }

  function showNextPreviewDoc() {
    if (selectedDocs.length <= 1) return;
    const nextIndex = previewDocIndex === selectedDocs.length - 1 ? 0 : previewDocIndex + 1;
    setPreviewDocId(selectedDocs[nextIndex].id);
  }

  function handleCitationClick(citation: { pageNumber: number; snippet: string }) {
    const pageNumber = Number(citation.pageNumber);
    if (!Number.isFinite(pageNumber) || pageNumber < 1) {
      setError("Citation page is invalid.");
      return;
    }
    setActiveCitation({
      pageNumber,
      snippet: citation.snippet || "",
      timestamp: Date.now(),
    });
  }

  if (loading) {
    return (
      <RequireAuth>
        <p className="text-sm text-zinc-500">Loading…</p>
      </RequireAuth>
    );
  }

  if (!doc) {
    return (
      <RequireAuth>
        <p className="text-sm text-red-600">{error ?? "Document not found."}</p>
        <Link href="/documents" className="mt-4 inline-block text-sm underline">
          Back to documents
        </Link>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="flex h-full flex-col overflow-hidden bg-slate-100 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="sticky top-0 z-30 w-full overflow-visible border-y border-slate-200/80 bg-white backdrop-blur-xl">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => router.push("/documents")}
                aria-label="Back to documents"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="flex flex-row flex-wrap gap-1.5 items-center justify-end">
              <div className="group/tip relative">
                <button
                  type="button"
                  onClick={() => router.push("/documents/multi")}
                  aria-label="Chat with multiple documents"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#0C2C55]/15 bg-slate-100 text-[#0C2C55] transition duration-200 hover:-translate-y-0.5 hover:border-[#0C2C55] hover:bg-[#0C2C55] hover:text-white active:border-[#0C2C55] active:bg-[#0C2C55] active:text-white"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-[#0C2C55] px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
                  Multi-document chat
                </span>
              </div>

              <div className="group/tip relative">
                <button
                  type="button"
                  onClick={onSummary}
                  disabled={summaryLoading}
                  aria-label="Generate summary"
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition duration-200 ${
                    summaryLoading
                      ? "cursor-wait border-[#0C2C55]/20 bg-slate-100 text-[#0C2C55]"
                      : "border-[#0C2C55]/15 bg-slate-100 text-[#0C2C55] hover:-translate-y-0.5 hover:border-[#0C2C55] hover:bg-[#0C2C55] hover:text-white active:border-[#0C2C55] active:bg-[#0C2C55] active:text-white"
                  }`}
                >
                  {summaryLoading ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3l1.2 3.2L16.4 7.4l-3.2 1.2L12 11.8l-1.2-3.2L7.6 7.4l3.2-1.2L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M18.5 11.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M6.5 13.5l.9 2.2 2.1.8-2.1.8-.9 2.2-.9-2.2-2.1-.8 2.1-.8.9-2.2Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-[#0C2C55] px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
                  {summaryLoading ? "Generating…" : "Generate summary"}
                </span>
              </div>

              <div className="group/tip relative">
                <button
                  type="button"
                  aria-label="Export as PDF"
                  onClick={() =>
                    downloadBlob(`/export/summary/${id}?format=pdf`, `summary-${id}.pdf`).catch((e) =>
                      setError(e instanceof Error ? e.message : "Export failed")
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#0C2C55]/15 bg-slate-100 text-[#0C2C55] transition duration-200 hover:-translate-y-0.5 hover:border-[#0C2C55] hover:bg-[#0C2C55] hover:text-white active:border-[#0C2C55] active:bg-[#0C2C55] active:text-white"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12" strokeLinecap="round" />
                    <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 21h14" strokeLinecap="round" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-[#0C2C55] px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
                  Export PDF
                </span>
              </div>

              <div className="group/tip relative">
                <button
                  type="button"
                  aria-label="Export as DOCX"
                  onClick={() =>
                    downloadBlob(`/export/summary/${id}?format=docx`, `summary-${id}.docx`).catch((e) =>
                      setError(e instanceof Error ? e.message : "Export failed")
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#0C2C55]/15 bg-slate-100 text-[#0C2C55] transition duration-200 hover:-translate-y-0.5 hover:border-[#0C2C55] hover:bg-[#0C2C55] hover:text-white active:border-[#0C2C55] active:bg-[#0C2C55] active:text-white"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                    <path d="M14 2v5h5" />
                    <path d="M9 13h6M9 17h6M9 9h2" strokeLinecap="round" />
                  </svg>
                </button>
                <span className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded bg-[#0C2C55] px-2 py-1 text-[11px] text-white opacity-0 transition-opacity group-hover/tip:opacity-100">
                  Export DOCX
                </span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm dark:bg-red-950 dark:text-red-200 sm:mx-5">
            {error}
          </div>
        )}

        <div className="grid flex-1 min-h-0 gap-0 px-0 py-0 lg:grid-cols-2">
          <div className={`order-2 h-full min-h-0 flex-col rounded-t-2xl border-l border-slate-200 bg-white p-0 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:order-2 ${showPreview ? "flex" : "hidden lg:flex"}`}>
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-white shadow-sm dark:bg-zinc-900/40">
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 text-sm font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  aria-label="Back to chat"
                  className="lg:hidden mr-2 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Chat
                </button>
                <div className="min-w-0 truncate text-center flex-1">
                  {selectedDocs.length > 1 && previewDoc
                    ? `${previewDocIndex + 1} of ${selectedDocs.length} files: ${previewDoc.original_filename}`
                    : previewDoc?.original_filename}
                </div>
                {selectedDocs.length > 1 && (
                  <div className="ml-4 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={showPreviousPreviewDoc}
                      aria-label="Previous file preview"
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={showNextPreviewDoc}
                      aria-label="Next file preview"
                      className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {previewLoading && previewDoc?.mime_type?.toLowerCase().includes("pdf") && <PdfPreviewSkeleton />}
                {previewLoading && !previewDoc?.mime_type?.toLowerCase().includes("pdf") && (
                  <p className="bg-white/70 p-4 text-sm text-slate-500">Loading preview…</p>
                )}
                {previewError && (
                  <p className="bg-red-50/80 p-4 text-sm text-red-600 dark:text-red-400">{previewError}</p>
                )}
                {!previewLoading && !previewError && previewKind === "pdf" && pdfData && (
                  <PdfLightPreview fileData={pdfData} showToolbar={false} activeCitation={activeCitation} />
                )}
                {!previewLoading && !previewError && previewKind === "text" && textFilePreview !== null && (
                  <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-white/80 p-4 text-xs text-slate-800 dark:text-zinc-200">
                    {textFilePreview || "(empty file)"}
                  </pre>
                )}
                {!previewLoading && !previewError && previewKind === "office" && fileBlobUrl && (
                  <div className="space-y-3 bg-white/70 p-4 text-sm text-slate-600 dark:text-zinc-400">
                    <p>Browsers cannot show Word (.docx) inline here. Open the file in Word or download it.</p>
                    <button
                      type="button"
                      onClick={() => window.open(fileBlobUrl, "_blank", "noopener,noreferrer")}
                      className="rounded-full bg-[#0C2C55] px-4 py-2 text-sm text-white transition hover:bg-[#10386a] dark:bg-[#0C2C55] dark:hover:bg-[#10386a]"
                    >
                      Open / download file
                    </button>
                  </div>
                )}
                {!previewLoading && !previewError && previewKind === null && (
                  <p className="bg-white/70 p-4 text-sm text-slate-500">No preview for this file type.</p>
                )}
              </div>
            </section>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1">
              {summary && (
                <div className="rounded-2xl bg-white p-4 text-sm text-slate-800 shadow-sm dark:bg-zinc-900/50 dark:text-zinc-200">
                  <h2 className="font-semibold text-slate-900 dark:text-zinc-100">Summary</h2>
                  <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap dark:prose-invert">{summary}</div>
                </div>
              )}
            </div>
          </div>

          <div className={`order-1 h-full min-h-0 flex-col bg-white p-0 shadow-[0_14px_34px_rgba(12,44,85,0.16)] dark:bg-zinc-900/40 lg:order-1 ${showPreview ? "hidden lg:flex" : "flex"}`}>
            {/* Mobile-only: toggle to document preview */}
            <div className="flex items-center justify-end border-b border-slate-100 bg-white px-4 py-2 lg:hidden">
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5" />
                </svg>
                View Document
              </button>
            </div>
            <ChatHeader
              title="Ask QueryBot"
              sessions={sessions}
              sessionId={sessionId}
              onDeleteSession={(deletedId) => {
                deleteChatSession(deletedId)
                  .then(() => {
                    setSessions((prev) => prev.filter((s) => s.id !== deletedId));
                    if (sessionId === deletedId) { setSessionId(null); setMessages([]); }
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Delete failed"));
              }}
              onRenameSession={(renamedId, newTitle) => {
                renameChatSession(renamedId, newTitle)
                  .then((updated) => {
                    setSessions((prev) =>
                      prev.map((s) => s.id === renamedId ? { ...s, title: updated.title } : s)
                    );
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Rename failed"));
              }}
              onSelectSession={(id) => {
                setEditingMessageId(null);
                setEditingDraft("");
                setSessionId(id);
              }}
              onNewChat={() => {
                setEditingMessageId(null);
                setEditingDraft("");
                setSessionId(null);
              }}
            />

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-zinc-900/50">
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100 p-4 dark:bg-zinc-900/40">
                  {messages.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Hi there! 👋 I’m here to help. Ask me anything about this document.
                    </p>
                  )}
                  {messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      sources={messageSources[m.id] ?? []}
                      onCitationClick={handleCitationClick}
                      isEditing={editingMessageId === m.id}
                      isEdited={editedMessageIds.has(m.id)}
                      editingDraft={editingDraft}
                      editSaving={sending}
                      isBookmarked={bookmarkedIds.has(m.id)}
                      bookmarkPending={bookmarkPendingIds.has(m.id)}
                      onToggleBookmark={onToggleBookmark}
                      onEdit={(msg) => {
                        setEditingMessageId(msg.id);
                        setEditingDraft(msg.content);
                      }}
                      onEditingDraftChange={setEditingDraft}
                      onSaveEdit={() => onSaveInlineEdit(m.id)}
                      onCancelEdit={() => {
                        setEditingMessageId(null);
                        setEditingDraft("");
                      }}
                    />
                  ))}
                  {thinking && <ThinkingBubble />}
                  <div ref={messagesEndRef} />
                </div>
                {sessionId && (
                  <div className="bg-slate-50/80 px-4 py-2 dark:bg-zinc-900/60">
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(`/export/chat/${sessionId}?format=pdf`, `chat-${sessionId}.pdf`).catch((e) =>
                          setError(e instanceof Error ? e.message : "Export failed")
                        )
                      }
                      className="mr-3 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 dark:text-zinc-400"
                    >
                      Export chat PDF
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadBlob(`/export/chat/${sessionId}?format=docx`, `chat-${sessionId}.docx`).catch((e) =>
                          setError(e instanceof Error ? e.message : "Export failed")
                        )
                      }
                      className="text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-800 dark:text-zinc-400"
                    >
                      Export chat DOCX
                    </button>
                  </div>
                )}
                <form onSubmit={onSend} className="bg-slate-50/70 p-3 dark:bg-zinc-900/70">
                  <div className="flex gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#0C2C55]/30 dark:bg-zinc-950/70 dark:ring-zinc-700 dark:focus-within:ring-[#0C2C55]">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!sending && input.trim()) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }
                      }}
                      placeholder="Ask something about the document…"
                      rows={2}
                      className="flex-1 resize-none rounded-lg bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                    <button
                      type="submit"
                      disabled={sending}
                      className="self-end rounded-xl bg-[#0C2C55] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#10386a] disabled:opacity-50 dark:bg-[#0C2C55] dark:hover:bg-[#10386a]"
                    >
                      {sending ? "…" : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}

/* ── Message bubble with action bar ───────────────────────── */
function MessageBubble({
  message,
  sources,
  onCitationClick,
  isEditing,
  isEdited,
  editingDraft,
  editSaving,
  isBookmarked,
  bookmarkPending,
  onToggleBookmark,
  onEdit,
  onEditingDraftChange,
  onSaveEdit,
  onCancelEdit,
}: {
  message: import("@/lib/api").ChatMessage;
  sources: CitationSource[];
  onCitationClick: (citation: { pageNumber: number; snippet: string }) => void;
  isEditing: boolean;
  isEdited: boolean;
  editingDraft: string;
  editSaving: boolean;
  isBookmarked: boolean;
  bookmarkPending: boolean;
  onToggleBookmark: (message: import("@/lib/api").ChatMessage) => void;
  onEdit: (message: import("@/lib/api").ChatMessage) => void;
  onEditingDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const parts = message.content.split(/(\[\d+\])/g);
  const citationRegex = /^\[(\d+)\]$/;

  return (
    <div className={`group flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={
          isUser && isEditing
            ? "w-full max-w-[38rem] text-sm"
            : `max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ${
                isUser
                  ? "rounded-tr-sm bg-[#0C2C55] text-white ring-[#0C2C55]/30"
                  : "rounded-tl-sm bg-white text-slate-900 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
              }`
        }
      >
        {isEditing && isUser ? (
          <div className="space-y-2">
            <textarea
              value={editingDraft}
              onChange={(e) => onEditingDraftChange(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editSaving || !editingDraft.trim()}
                onClick={onSaveEdit}
                className="rounded-xl bg-[#0C2C55] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#10386a] disabled:opacity-60"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {parts.map((part, idx) => {
              const match = citationRegex.exec(part);
              if (!match) return <span key={`${message.id}-txt-${idx}`}>{part}</span>;
              const citationIndex = Number(match[1]);
              const source = sources.find((item) => item.index === citationIndex);
              if (!source || !source.page_number) {
                return (
                  <span key={`${message.id}-cit-${idx}`} className="text-slate-400">
                    {part}
                  </span>
                );
              }
              return (
                <button
                  key={`${message.id}-cit-${idx}`}
                  type="button"
                  onClick={() =>
                    onCitationClick({
                      pageNumber: source.page_number as number,
                      snippet: source.content || "",
                    })
                  }
                  title={`Go to page ${source.page_number}${source.file_name ? ` • ${source.file_name}` : ""}`}
                  className={`mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0 text-[11px] transition ${
                    isUser
                      ? "border-blue-200/40 bg-blue-100/20 text-blue-50 hover:bg-blue-100/35"
                      : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                  }`}
                >
                  {part}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {isEdited && isUser && (
        <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">edited</div>
      )}

      {/* Action bar — always visible */}
      <div
        className={`flex items-center gap-0.5 ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Copy */}
        <button
          type="button"
          aria-label="Copy message"
          onClick={handleCopy}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-green-500">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Bookmark */}
        <button
          type="button"
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark message"}
          onClick={() => onToggleBookmark(message)}
          disabled={bookmarkPending}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill={isBookmarked ? "#0C2C55" : "none"}
            stroke={isBookmarked ? "#0C2C55" : "currentColor"}
            strokeWidth="2"
            className="h-3.5 w-3.5"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Edit — user messages only */}
        {isUser && (
          <button
            type="button"
            aria-label="Edit message"
            onClick={() => onEdit(message)}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
              isEditing
                ? "bg-[#0C2C55]/10 text-[#0C2C55]"
                : "text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm shadow-sm dark:bg-zinc-800">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          <span className="ml-1 text-slate-500">Thinking…</span>
        </div>
      </div>
    </div>
  );
}
