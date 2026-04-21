"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChatHeader } from "@/components/ChatHeader";
import { RequireAuth } from "@/components/RequireAuth";
import { api, editChatMessage, type ChatMessage, type ChatSendResponse, type ChatSession, type Document } from "@/lib/api";

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

  const normalizedSelectedIds = useMemo(() => [...selectedIds].sort(), [selectedIds]);

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
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load multi-document chat");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMessages(sid: string) {
    const msgs = await api<ChatMessage[]>(`/chat/sessions/${sid}/messages`);
    setMessages(msgs);
  }

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setEditingMessageId(null);
      setEditingDraft("");
      return;
    }
    loadMessages(sessionId).catch((e) => setError(e instanceof Error ? e.message : "Failed to load messages"));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const stillValid = matchingSessions.some((session) => session.id === sessionId);
    if (!stillValid) {
      setSessionId(null);
      setMessages([]);
    }
  }, [matchingSessions, sessionId]);

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
    if (!input.trim()) return;
    if (normalizedSelectedIds.length === 0) {
      setError("Select at least one document before asking a question.");
      return;
    }

    setSending(true);
    setThinking(true);
    setError(null);

    try {
      const body: { document_ids: string[]; message: string; session_id?: string } = {
        document_ids: normalizedSelectedIds,
        message: input.trim(),
      };
      if (sessionId) body.session_id = sessionId;

      const [res] = await Promise.all([
        api<ChatSendResponse>("/chat/messages", {
          method: "POST",
          body: JSON.stringify(body),
        }),
        new Promise((resolve) => window.setTimeout(resolve, 2000)),
      ]);

      setThinking(false);
      setSessionId(res.session_id);
      setInput("");
      await loadMessages(res.session_id);
      const allSessions = await api<ChatSession[]>("/chat/sessions");
      setSessions(allSessions);
    } catch (e) {
      setThinking(false);
      setError(e instanceof Error ? e.message : "Send failed");
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
        <div className="p-6 text-sm text-slate-500">Loading…</div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Multi-document chat</h1>
              <p className="text-sm text-slate-500">Ask one question across multiple documents.</p>
            </div>
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to documents
            </Link>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Select documents</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {selectedIds.length} selected
                </span>
              </div>

              <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {documents.map((document) => (
                  <label
                    key={document.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(document.id)}
                      onChange={() => toggleDocument(document.id)}
                      className="mt-0.5 rounded"
                    />
                    <span className="line-clamp-2 text-slate-700">{document.original_filename}</span>
                  </label>
                ))}
                {documents.length === 0 && (
                  <p className="text-sm text-slate-400">No documents uploaded yet.</p>
                )}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                Changing selected documents starts a new thread automatically.
              </p>
            </aside>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ChatHeader
                title="Ask QueryBot"
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
              />

              <div className="flex h-[72vh] min-h-[600px] flex-col bg-slate-100">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.length === 0 && !thinking && (
                    <p className="text-sm text-slate-500">
                      Hi there! I am here to help. Ask me anything about the selected documents.
                    </p>
                  )}

                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isEditing={editingMessageId === message.id}
                      isEdited={editedMessageIds.has(message.id)}
                      editingDraft={editingDraft}
                      editSaving={sending}
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
                </div>

                <form onSubmit={onSend} className="border-t border-slate-200 bg-slate-50 p-3">
                  <div className="flex gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#0C2C55]/30">
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
                          ? `Ask about ${selectedIds.length} selected document${selectedIds.length > 1 ? "s" : ""}...`
                          : "Select document(s) first..."
                      }
                      rows={2}
                      className="flex-1 resize-none rounded-lg bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || selectedIds.length === 0}
                      className="self-end rounded-xl bg-[#0C2C55] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#10386a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {sending ? "..." : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
          <span className="ml-1 text-slate-500">Thinking...</span>
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
  onEdit: (message: ChatMessage) => void;
  onEditingDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

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
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark message"}
          onClick={() => setBookmarked((b) => !b)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 24 24"
            fill={bookmarked ? "#0C2C55" : "none"}
            stroke={bookmarked ? "#0C2C55" : "currentColor"}
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
