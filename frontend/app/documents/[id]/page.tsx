"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import {
  api,
  downloadBlob,
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/documents")}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← All documents
            </button>
            <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{doc.original_filename}</h1>
            <p className="mt-1 text-xs text-zinc-500">Preview: {doc.text_preview.slice(0, 200)}…</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSummary}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
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
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
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
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              Export summary DOCX
            </button>
          </div>
        </div>

        {summary && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Summary</h2>
            <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap dark:prose-invert">{summary}</div>
          </div>
        )}

        {allDocs.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Multi-document context</p>
            <p className="text-xs text-zinc-500">
              Include additional uploaded files when starting a new thread only (locked while a saved session is selected).
            </p>
            <ul className="mt-2 space-y-1">
              {allDocs.map((d) => (
                <li key={d.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      disabled={!!sessionId}
                      checked={extraIds.includes(d.id)}
                      onChange={() => toggleExtra(d.id)}
                    />
                    <span>{d.original_filename}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Chat sessions</h2>
            <button
              type="button"
              onClick={() => {
                setSessionId(null);
              }}
              className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                sessionId === null ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              New thread
            </button>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setExtraIds([]);
                  setSessionId(s.id);
                }}
                className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                  sessionId === s.id ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <span className="line-clamp-2">{s.title}</span>
                <span className="block text-xs text-zinc-500">{new Date(s.created_at).toLocaleString()}</span>
              </button>
            ))}
          </aside>

          <div className="flex min-h-[420px] flex-col rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-sm text-zinc-500">Ask a question about this document. Responses are mocked for MVP.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  <div className="text-xs opacity-70">{m.role}</div>
                  <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
            {sessionId && (
              <div className="border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(`/export/chat/${sessionId}?format=pdf`, `chat-${sessionId}.pdf`).catch((e) =>
                      setError(e instanceof Error ? e.message : "Export failed")
                    )
                  }
                  className="mr-2 text-xs text-zinc-600 underline dark:text-zinc-400"
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
                  className="text-xs text-zinc-600 underline dark:text-zinc-400"
                >
                  Export chat DOCX
                </button>
              </div>
            )}
            <form onSubmit={onSend} className="border-t border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask something about the document…"
                  rows={2}
                  className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="self-end rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {sending ? "…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
