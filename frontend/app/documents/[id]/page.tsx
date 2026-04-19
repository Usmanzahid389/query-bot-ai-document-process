"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  api,
  downloadBlob,
  fetchDocumentFile,
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
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [textFilePreview, setTextFilePreview] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<"pdf" | "text" | "office" | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const documentIds = useMemo(() => {
    const set = new Set<string>([id, ...extraIds]);
    return Array.from(set);
  }, [id, extraIds]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [d, list, sess] = await Promise.all([
        api<Document>(`/documents/${id}`),
        api<Document[]>("/documents"),
        api<ChatSession[]>(`/chat/sessions?document_id=${encodeURIComponent(id)}`),
      ]);
      setDoc(d);
      setAllDocs(list.filter((x) => x.id !== id));
      setSessions(sess);
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
    if (!doc) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setFileBlobUrl(null);
    setTextFilePreview(null);
    setPreviewKind(null);
    setPreviewError(null);

    let cancelled = false;

    (async () => {
      setPreviewLoading(true);
      try {
        const blob = await fetchDocumentFile(id);
        const mt = doc.mime_type.toLowerCase();
        if (mt.includes("pdf")) {
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          if (!cancelled) {
            setFileBlobUrl(url);
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
  }, [doc, id]);

  async function loadMessages(sid: string) {
    const msgs = await api<ChatMessage[]>(`/chat/sessions/${sid}/messages`);
    setMessages(msgs);
  }

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    loadMessages(sessionId).catch((e) => setError(e instanceof Error ? e.message : "Failed to load messages"));
  }, [sessionId]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    setError(null);
    try {
      const body: {
        document_ids: string[];
        message: string;
        session_id?: string;
      } = { document_ids: documentIds, message: input.trim() };
      if (sessionId) body.session_id = sessionId;

      const res = await api<ChatSendResponse>("/chat/messages", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSessionId(res.session_id);
      setInput("");
      await loadMessages(res.session_id);
      const sess = await api<ChatSession[]>(`/chat/sessions?document_id=${encodeURIComponent(id)}`);
      setSessions(sess);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function onSummary() {
    setError(null);
    try {
      const s = await api<SummaryResponse>(`/documents/${id}/summary`, { method: "POST" });
      setSummary(s.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed");
    }
  }

  function toggleExtra(docId: string) {
    setExtraIds((prev) => (prev.includes(docId) ? prev.filter((x) => x !== docId) : [...prev, docId]));
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
      <div className="space-y-5 rounded-3xl bg-slate-100 p-4 sm:p-6 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl bg-white p-5 shadow-md shadow-slate-200/60 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.push("/documents")}
              className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            >
              ← All documents
            </button>
            <h1 className="mt-3 truncate text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">{doc.original_filename}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-zinc-300">
              Text extract:{" "}
              {doc.text_preview.length > 200
                ? `${doc.text_preview.slice(0, 200)}…`
                : doc.text_preview || "(empty)"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/80 p-1.5 shadow-sm dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={onSummary}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-zinc-700 dark:text-zinc-100"
            >
              Generate summary
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlob(`/export/summary/${id}?format=pdf`, `summary-${id}.pdf`).catch((e) =>
                  setError(e instanceof Error ? e.message : "Export failed")
                )
              }
              className="rounded-xl bg-[#0C2C55]/10 px-4 py-2 text-sm font-semibold text-[#0C2C55] transition hover:bg-[#0C2C55]/15 dark:bg-[#0C2C55]/30 dark:text-slate-200"
            >
              Export summary PDF
            </button>
            <button
              type="button"
              onClick={() =>
                downloadBlob(`/export/summary/${id}?format=docx`, `summary-${id}.docx`).catch((e) =>
                  setError(e instanceof Error ? e.message : "Export failed")
                )
              }
              className="rounded-xl bg-[#0C2C55]/10 px-4 py-2 text-sm font-semibold text-[#0C2C55] transition hover:bg-[#0C2C55]/15 dark:bg-[#0C2C55]/30 dark:text-slate-200"
            >
              Export summary DOCX
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="order-2 flex h-[88vh] min-h-[800px] max-h-[1080px] flex-col rounded-2xl bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.08)] lg:order-2">
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900/40">
              <h2 className="bg-white/80 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:bg-zinc-900/80 dark:text-zinc-100">
                File preview
              </h2>
              <div className="flex-1 overflow-y-auto">
                {previewLoading && <p className="bg-white/70 p-4 text-sm text-slate-500">Loading preview…</p>}
                {previewError && (
                  <p className="bg-red-50/80 p-4 text-sm text-red-600 dark:text-red-400">{previewError}</p>
                )}
                {!previewLoading && !previewError && previewKind === "pdf" && fileBlobUrl && (
                  <iframe
                    title="PDF preview"
                    src={fileBlobUrl}
                    className="block h-full w-full bg-white"
                  />
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

              {allDocs.length > 0 && (
                <div className="rounded-2xl bg-slate-100/80 p-4 shadow-sm dark:bg-zinc-900/60">
                  <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Multi-document context</p>
                  <p className="text-xs text-slate-500">
                    Include additional uploaded files when starting a new thread only (locked while a saved session is selected).
                  </p>
                  <ul className="mt-3 space-y-2">
                    {allDocs.map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-slate-200 dark:hover:bg-zinc-800/80">
                          <input
                            type="checkbox"
                            disabled={!!sessionId}
                            checked={extraIds.includes(d.id)}
                            onChange={() => toggleExtra(d.id)}
                            className="rounded"
                          />
                          <span>{d.original_filename}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="order-1 flex h-[88vh] min-h-[800px] max-h-[1080px] flex-col rounded-2xl bg-white p-3 shadow-[0_14px_34px_rgba(12,44,85,0.16)] dark:bg-zinc-900/40 lg:order-1">
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[220px_1fr]">
              <aside className="flex h-full min-h-0 flex-col rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900/60">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chat sessions</h2>
                <button
                  type="button"
                  onClick={() => {
                    setSessionId(null);
                  }}
                  className={`mb-2 w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                    sessionId === null
                      ? "bg-[#0C2C55]/10 font-medium text-[#0C2C55] dark:bg-zinc-800 dark:text-zinc-100"
                      : "hover:bg-slate-200 dark:hover:bg-zinc-900"
                  }`}
                >
                  New thread
                </button>
                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setExtraIds([]);
                        setSessionId(s.id);
                      }}
                      className={`w-full rounded-lg px-2 py-2 text-left text-sm transition ${
                        sessionId === s.id
                          ? "bg-[#0C2C55]/10 font-medium text-[#0C2C55] dark:bg-zinc-800 dark:text-zinc-100"
                          : "hover:bg-slate-200 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className="line-clamp-2">{s.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-[0_10px_24px_rgba(12,44,85,0.14)] dark:bg-zinc-900/50">
                <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-[#0C2C55]/[0.06] via-white to-slate-50/70 p-4 dark:from-zinc-900/60 dark:to-zinc-900/30">
                  {messages.length === 0 && (
                    <p className="text-sm text-slate-500">
                      Ask a question about this document. Replies use RAG + Ollama (first reply can take a minute).
                    </p>
                  )}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                        m.role === "user"
                          ? "ml-auto rounded-tr-sm bg-[#0C2C55] text-white dark:bg-[#0C2C55]"
                          : "rounded-tl-sm bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100"
                      }`}
                    >
                      <div className="text-xs opacity-70">{m.role}</div>
                      <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
                    </div>
                  ))}
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
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
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
