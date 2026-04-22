"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatHeader } from "@/components/ChatHeader";
import { PdfLightPreview, PdfPreviewSkeleton } from "@/components/PdfLightPreview";
import { RequireAuth } from "@/components/RequireAuth";
import {
  api,
  createBookmark,
  deleteChatSession,
  deleteBookmarkByMessage,
  editChatMessage,
  fetchDocumentFile,
  listBookmarkedMessageIds,
  renameChatSession,
  type ChatMessage,
  type ChatSendResponse,
  type ChatSession,
  type Document,
} from "@/lib/api";

export default function MultiDocumentChatPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [editedMessageIds, setEditedMessageIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkPendingIds, setBookmarkPendingIds] = useState<Set<string>>(new Set());

  const normalizedSelectedIds = useMemo(() => [...selectedIds].sort(), [selectedIds]);

  const selectedDocs = useMemo(
    () => documents.filter((d) => selectedIds.includes(d.id)),
    [documents, selectedIds]
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  // True once the initial load (including localStorage restore) has finished.
  // The validity check must not fire before this because matchingSessions is
  // recomputed from restored selectedIds — it may momentarily appear empty.
  const loadedRef = useRef(false);
  const [mobilePickerOpen, setMobilePickerOpen] = useState(false);

  // ── Preview panel state ────────────────────────────────────
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [pdfEntry, setPdfEntry] = useState<{ docId: string; data: Uint8Array } | null>(null);
  // Only expose the buffer when it belongs to the currently active doc, preventing
  // detached-ArrayBuffer errors when the user navigates between files.
  const pdfData = pdfEntry?.docId === previewDocId ? pdfEntry.data : null;
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [textFilePreview, setTextFilePreview] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"pdf" | "text" | "office" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Open preview panel by default on xl+ screens (after hydration)
  useEffect(() => {
    if (window.innerWidth >= 1280) setPreviewPanelOpen(true);
  }, []);

  // Keep previewDocId in sync with selectedIds
  useEffect(() => {
    if (selectedIds.length === 0) {
      setPreviewDocId(null);
      return;
    }
    setPreviewDocId((cur) => {
      if (cur && selectedIds.includes(cur)) return cur;
      return selectedIds[0];
    });
  }, [selectedIds]);

  // Load file for the active preview document
  const previewDoc = useMemo(
    () => documents.find((d) => d.id === previewDocId) ?? null,
    [documents, previewDocId]
  );

  useEffect(() => {
    if (!previewDoc) {
      setPdfEntry(null);
      setFileBlobUrl(null);
      setTextFilePreview(null);
      setPreviewKind(null);
      setPreviewError(null);
      return;
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPdfEntry(null);
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
        const blobType = (blob.type || "").toLowerCase();
        const isPdfPreview = blobType.includes("pdf") || mt.includes("pdf");
        if (isPdfPreview) {
          const buffer = await blob.arrayBuffer();
          if (!cancelled) { setPdfEntry({ docId: previewDoc.id, data: new Uint8Array(buffer) }); setPreviewKind("pdf"); }
        } else if (mt.startsWith("text/")) {
          const text = await blob.text();
          if (!cancelled) { setTextFilePreview(text); setPreviewKind("text"); }
        } else if (mt.includes("wordprocessingml") || mt.includes("msword")) {
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          if (!cancelled) { setFileBlobUrl(url); setPreviewKind("office"); }
        }
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : "Could not load preview");
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

  const matchingSessions = useMemo(() => {
    const selectedSet = new Set(normalizedSelectedIds);
    return sessions.filter((session) => {
      if (session.document_ids.length !== selectedSet.size) return false;
      return session.document_ids.every((docId) => selectedSet.has(docId));
    });
  }, [sessions, normalizedSelectedIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [docs, allSessions] = await Promise.all([
          api<Document[]>("/documents"),
          api<ChatSession[]>("/chat/sessions"),
        ]);
        if (cancelled) return;
        setDocuments(docs);
        setSessions(allSessions);

        // Restore last selected docs (validate against loaded docs)
        try {
          const savedDocs = localStorage.getItem("multi_chat_selected_docs");
          if (savedDocs) {
            const parsed = JSON.parse(savedDocs) as string[];
            const valid = parsed.filter((did) => docs.some((d) => d.id === did));
            if (valid.length > 0) setSelectedIds(valid);
          }
        } catch { /* ignore malformed storage */ }

        // Restore last session (validate against loaded sessions)
        const savedSession = localStorage.getItem("multi_chat_session");
        if (savedSession && allSessions.some((s) => s.id === savedSession)) {
          setSessionId(savedSession);
        } else {
          localStorage.removeItem("multi_chat_session");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load multi-document chat");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          loadedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist selectedIds to localStorage — skip the initial mount run (before load has
  // finished) to avoid wiping localStorage before we've had a chance to read from it.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (selectedIds.length > 0) {
      localStorage.setItem("multi_chat_selected_docs", JSON.stringify(selectedIds));
    } else {
      localStorage.removeItem("multi_chat_selected_docs");
    }
  }, [selectedIds]);

  // Persist sessionId to localStorage — same guard as above.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (sessionId) {
      localStorage.setItem("multi_chat_session", sessionId);
    } else {
      localStorage.removeItem("multi_chat_session");
    }
  }, [sessionId]);

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
      setMessages([]);
      setBookmarkedIds(new Set());
      setEditingMessageId(null);
      setEditingDraft("");
      return;
    }
    Promise.all([loadMessages(sessionId), loadBookmarkedIds(sessionId)]).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load messages")
    );
  }, [sessionId]);

  useEffect(() => {
    // Skip the check on the initial restore — matchingSessions may not yet reflect
    // the restored selectedIds if they haven't finished batching.
    if (!loadedRef.current) return;
    if (!sessionId) return;
    const stillValid = matchingSessions.some((session) => session.id === sessionId);
    if (!stillValid) {
      setSessionId(null);
      setMessages([]);
    }
  }, [matchingSessions, sessionId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function toggleDocument(documentId: string) {
    if (sessionId) {
      setSessionId(null);
      setMessages([]);
    }
    setEditingMessageId(null);
    setEditingDraft("");
    setSelectedIds((prev) => (prev.includes(documentId) ? prev.filter((id) => id !== documentId) : [...prev, documentId]));
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (normalizedSelectedIds.length === 0) {
      setError("Select at least one document before asking a question.");
      return;
    }

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
      const body: { document_ids: string[]; message: string; session_id?: string } = {
        document_ids: normalizedSelectedIds,
        message: text,
      };
      if (sessionId) body.session_id = sessionId;

      const res = await api<ChatSendResponse>("/chat/messages", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setThinking(false);
      setSessionId(res.session_id);
      // Replace optimistic message with authoritative server messages
      await loadMessages(res.session_id);
      const allSessions = await api<ChatSession[]>("/chat/sessions");
      setSessions(allSessions);
    } catch (e) {
      setThinking(false);
      setError(e instanceof Error ? e.message : "Send failed");
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setSending(false);
    }
  }

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
    } catch (e) {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (wasBookmarked) next.add(message.id);
        else next.delete(message.id);
        return next;
      });
      setError(e instanceof Error ? e.message : "Bookmark update failed");
    } finally {
      setBookmarkPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(message.id);
        return next;
      });
    }
  }

  async function onSaveInlineEdit(messageId: string) {
    if (!editingDraft.trim()) return;
    setSending(true);
    setThinking(true);
    setError(null);
    try {
      const res = await editChatMessage(messageId, editingDraft.trim());
      setThinking(false);
      setSessionId(res.session_id);
      setEditingMessageId(null);
      setEditingDraft("");
      setEditedMessageIds((prev) => new Set(prev).add(res.user_message.id));
      await loadMessages(res.session_id);
      const allSessions = await api<ChatSession[]>("/chat/sessions");
      setSessions(allSessions);
    } catch (e) {
      setThinking(false);
      setError(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <RequireAuth>
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            Loading…
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="flex h-full flex-col overflow-hidden bg-slate-100">

        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <button
            type="button"
            onClick={() => { void (window.location.href = "/documents"); }}
            aria-label="Back to documents"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-tight text-slate-900">Multi-document chat</p>
            <p className="truncate text-xs text-slate-500">
              {selectedIds.length > 0
                ? `${selectedIds.length} document${selectedIds.length > 1 ? "s" : ""} selected`
                : "Select documents to begin"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile: toggle preview panel */}
            {selectedIds.length > 0 && (
              <button
                type="button"
                aria-label="Toggle document preview"
                onClick={() => setPreviewPanelOpen((p) => !p)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition hover:border-slate-300 hover:text-slate-800 lg:hidden ${
                  previewPanelOpen
                    ? "border-[#0C2C55] bg-[#0C2C55] text-white"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" strokeLinecap="round" />
                </svg>
              </button>
            )}

            {/* Mobile: toggle doc picker */}
            <button
              type="button"
              aria-label="Toggle document picker"
              onClick={() => setMobilePickerOpen((p) => !p)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800 xl:hidden"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {selectedIds.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0C2C55] text-[9px] font-bold text-white">
                  {selectedIds.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Error banner ────────────────────────────────────── */}
        {error && (
          <div className="mx-4 mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
            {error}
          </div>
        )}

        {/* ── Mobile doc picker (slide down) ───────────────────── */}
        {mobilePickerOpen && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-3 shadow-md lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Select Documents</span>
              <button
                type="button"
                onClick={() => setMobilePickerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="max-h-52 space-y-0.5 overflow-y-auto">
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    selectedIds.includes(doc.id)
                      ? "bg-[#0C2C55]/8 text-[#0C2C55]"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="rounded accent-[#0C2C55]"
                  />
                  <span className="min-w-0 truncate">{doc.original_filename}</span>
                </label>
              ))}
              {documents.length === 0 && (
                <p className="py-3 text-center text-xs text-slate-400">No documents uploaded yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Main body ───────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* ── Left: Document picker panel (desktop) ──────────── */}
          <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white xl:flex">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">Documents</span>
              {selectedIds.length > 0 && (
                <span className="rounded-full bg-[#0C2C55] px-2.5 py-0.5 text-[11px] font-bold text-white">
                  {selectedIds.length}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="space-y-0.5">
                {documents.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-400">No documents uploaded yet.</p>
                )}
                {documents.map((doc) => (
                  <label
                    key={doc.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                      selectedIds.includes(doc.id)
                        ? "bg-[#0C2C55]/8 text-[#0C2C55]"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => toggleDocument(doc.id)}
                      className="rounded accent-[#0C2C55]"
                    />
                    <span className="min-w-0 truncate leading-snug">{doc.original_filename}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 px-4 py-3">
              <p className="text-[11px] leading-relaxed text-slate-400">
                Changing selected documents starts a new chat thread automatically.
              </p>
            </div>
          </aside>

          {/* ── Center: Chat panel ─────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col bg-white shadow-[0_14px_34px_rgba(12,44,85,0.12)]">

            {/* ChatHeader (slide-over sidebar for history) */}
            <ChatHeader
              title="Ask QueryBot"
              hideHistory
              sessions={matchingSessions}
              sessionId={sessionId}
              onSelectSession={(id) => {
                setEditingMessageId(null);
                setEditingDraft("");
                setSessionId(id);
              }}
              onNewChat={() => {
                setEditingMessageId(null);
                setEditingDraft("");
                setSessionId(null);
                setMessages([]);
              }}
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
                      prev.map((s) => (s.id === renamedId ? { ...s, title: updated.title } : s))
                    );
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : "Rename failed"));
              }}
            />

            {/* Selected document chips */}
            {selectedIds.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/70 px-4 py-2">
                {selectedDocs.map((doc) => (
                  <span
                    key={doc.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#0C2C55]/20 bg-[#0C2C55]/5 px-2.5 py-1 text-[11px] font-medium text-[#0C2C55]"
                  >
                    <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" strokeLinecap="round" />
                    </svg>
                    <span className="max-w-[140px] truncate">{doc.original_filename}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${doc.original_filename}`}
                      onClick={() => toggleDocument(doc.id)}
                      className="ml-0.5 rounded-full text-[#0C2C55]/50 transition hover:text-[#0C2C55]"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Messages area */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-4">
              {/* Empty state when no docs selected */}
              {selectedIds.length === 0 && messages.length === 0 && !thinking && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0C2C55]/8 text-[#0C2C55]">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">No documents selected</p>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                      {documents.length > 0
                        ? "Select one or more documents from the panel to start chatting."
                        : "Upload documents from the Documents page, then return here to chat."}
                    </p>
                  </div>
                  {documents.length === 0 && (
                    <Link
                      href="/documents"
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#0C2C55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10386a]"
                    >
                      Go to Documents
                    </Link>
                  )}
                </div>
              )}

              {/* Welcome message when docs are selected but no chat yet */}
              {selectedIds.length > 0 && messages.length === 0 && !thinking && (
                <p className="text-sm text-slate-500">
                  Hi there! 👋 I'm here to help. Ask me anything about the selected documents.
                </p>
              )}

              {/* Chat messages */}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isEditing={editingMessageId === message.id}
                  isEdited={editedMessageIds.has(message.id)}
                  editingDraft={editingDraft}
                  editSaving={sending}
                  isBookmarked={bookmarkedIds.has(message.id)}
                  bookmarkPending={bookmarkPendingIds.has(message.id)}
                  onToggleBookmark={onToggleBookmark}
                  onEdit={(msg) => {
                    setEditingMessageId(msg.id);
                    setEditingDraft(msg.content);
                  }}
                  onEditingDraftChange={setEditingDraft}
                  onSaveEdit={() => onSaveInlineEdit(message.id)}
                  onCancelEdit={() => {
                    setEditingMessageId(null);
                    setEditingDraft("");
                  }}
                />
              ))}

              {thinking && <ThinkingBubble />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={onSend} className="shrink-0 bg-slate-50/70 p-3">
              <div className="flex gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#0C2C55]/30">
                <textarea
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
                  placeholder={
                    selectedIds.length > 0
                      ? "Ask something about your documents…"
                      : "Select document(s) first…"
                  }
                  rows={2}
                  disabled={selectedIds.length === 0}
                  className="flex-1 resize-none rounded-lg bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={sending || selectedIds.length === 0}
                  className="self-end rounded-xl bg-[#0C2C55] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#10386a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </form>
          </div>

          {/* ── Right: Document preview panel ──────────────────── */}
          {selectedIds.length > 0 && previewPanelOpen && (
            <div className="hidden w-[420px] shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
              {/* File navigator header */}
              {(() => {
                const total = selectedDocs.length;
                const idx = selectedDocs.findIndex((d) => d.id === previewDocId);
                const current = idx >= 0 ? idx : 0;
                const goPrev = () => setPreviewDocId(selectedDocs[(current - 1 + total) % total].id);
                const goNext = () => setPreviewDocId(selectedDocs[(current + 1) % total].id);
                return (
                  <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
                    {/* Label */}
                    <span className="min-w-0 flex-1 truncate text-center text-xs text-slate-600">
                      <span className="font-medium text-slate-500">{current + 1} of {total} files:</span>{" "}
                      {previewDoc?.original_filename ?? ""}
                    </span>
                    {/* Prev / Next */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Previous file"
                        disabled={total <= 1}
                        onClick={goPrev}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next file"
                        disabled={total <= 1}
                        onClick={goNext}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {/* Collapse button */}
                    <button
                      type="button"
                      aria-label="Close preview panel"
                      onClick={() => setPreviewPanelOpen(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                );
              })()}

              {/* Preview content */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {previewLoading && previewDoc?.mime_type?.toLowerCase().includes("pdf") && <PdfPreviewSkeleton />}
                {previewLoading && !(previewDoc?.mime_type?.toLowerCase().includes("pdf")) && (
                  <p className="p-4 text-sm text-slate-500">Loading preview…</p>
                )}
                {previewError && (
                  <p className="p-4 text-sm text-red-600">{previewError}</p>
                )}
                {!previewLoading && !previewError && previewKind === "pdf" && pdfData && (
                  <PdfLightPreview key={previewDocId ?? undefined} fileData={pdfData} showToolbar={false} />
                )}
                {!previewLoading && !previewError && previewKind === "text" && textFilePreview !== null && (
                  <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-white p-4 text-xs text-slate-800">
                    {textFilePreview || "(empty file)"}
                  </pre>
                )}
                {!previewLoading && !previewError && previewKind === "office" && fileBlobUrl && (
                  <div className="space-y-3 bg-white p-4 text-sm text-slate-600">
                    <p>Browsers cannot render Word files inline. Download to view.</p>
                    <button
                      type="button"
                      onClick={() => window.open(fileBlobUrl, "_blank", "noopener,noreferrer")}
                      className="rounded-full bg-[#0C2C55] px-4 py-2 text-sm text-white transition hover:bg-[#10386a]"
                    >
                      Open / download file
                    </button>
                  </div>
                )}
                {!previewLoading && !previewError && previewKind === null && previewDocId && (
                  <p className="p-4 text-sm text-slate-500">No preview available for this file type.</p>
                )}
                {!previewDocId && (
                  <div className="flex h-full items-center justify-center text-center">
                    <p className="text-xs text-slate-400">Select a document above to preview it.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collapsed preview — re-open button (xl only, when panel was closed) */}
          {selectedIds.length > 0 && !previewPanelOpen && (
            <div className="hidden lg:flex shrink-0 flex-col items-center border-l border-slate-200 bg-white py-3 px-1.5">
              <button
                type="button"
                aria-label="Open document preview"
                onClick={() => setPreviewPanelOpen(true)}
                title="Show document preview"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Mobile preview drawer (below chat, toggled from top bar) */}
          {selectedIds.length > 0 && previewPanelOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
              {/* Drawer header — file navigator */}
              {(() => {
                const total = selectedDocs.length;
                const idx = selectedDocs.findIndex((d) => d.id === previewDocId);
                const current = idx >= 0 ? idx : 0;
                const goPrev = () => setPreviewDocId(selectedDocs[(current - 1 + total) % total].id);
                const goNext = () => setPreviewDocId(selectedDocs[(current + 1) % total].id);
                return (
                  <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-center text-xs text-slate-600">
                      <span className="font-medium text-slate-500">{current + 1} of {total} files:</span>{" "}
                      {previewDoc?.original_filename ?? ""}
                    </span>
                    <button
                      type="button"
                      aria-label="Previous file"
                      disabled={total <= 1}
                      onClick={goPrev}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Next file"
                      disabled={total <= 1}
                      onClick={goNext}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 disabled:opacity-40"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Close preview"
                      onClick={() => setPreviewPanelOpen(false)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              })()}
              {/* Preview content */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {previewLoading && <p className="p-4 text-sm text-slate-500">Loading preview…</p>}
                {previewError && <p className="p-4 text-sm text-red-600">{previewError}</p>}
                {!previewLoading && !previewError && previewKind === "pdf" && pdfData && (
                  <PdfLightPreview key={previewDocId ?? undefined} fileData={pdfData} showToolbar={false} />
                )}
                {!previewLoading && !previewError && previewKind === "text" && textFilePreview !== null && (
                  <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-white p-4 text-xs text-slate-800">
                    {textFilePreview || "(empty file)"}
                  </pre>
                )}
                {!previewLoading && !previewError && previewKind === "office" && fileBlobUrl && (
                  <div className="space-y-3 p-4 text-sm text-slate-600">
                    <p>Browsers cannot render Word files inline.</p>
                    <button
                      type="button"
                      onClick={() => window.open(fileBlobUrl, "_blank", "noopener,noreferrer")}
                      className="rounded-full bg-[#0C2C55] px-4 py-2 text-sm text-white hover:bg-[#10386a]"
                    >
                      Open / download file
                    </button>
                  </div>
                )}
                {!previewLoading && !previewError && previewKind === null && previewDocId && (
                  <p className="p-4 text-sm text-slate-500">No preview available for this file type.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
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

function MessageBubble({
  message,
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
  message: ChatMessage;
  isEditing: boolean;
  isEdited: boolean;
  editingDraft: string;
  editSaving: boolean;
  isBookmarked: boolean;
  bookmarkPending: boolean;
  onToggleBookmark: (message: ChatMessage) => void;
  onEdit: (message: ChatMessage) => void;
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
          <div className="whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
      {isEdited && isUser && (
        <div className="px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">edited</div>
      )}

      <div
        className={`flex items-center gap-0.5 ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
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
