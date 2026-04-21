"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { deleteBookmarkByMessage, listBookmarks, type Bookmark } from "@/lib/api";

export default function BookmarksPage() {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingMessageId, setRemovingMessageId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const bookmarks = await listBookmarks(200);
        if (!cancelled) setItems(bookmarks);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load bookmarks");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRemove(item: Bookmark) {
    setRemovingMessageId(item.message_id);
    setError(null);
    try {
      await deleteBookmarkByMessage(item.message_id);
      setItems((prev) => prev.filter((b) => b.message_id !== item.message_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove bookmark");
    } finally {
      setRemovingMessageId(null);
    }
  }

  return (
    <RequireAuth>
      <div className="min-h-screen bg-slate-50 px-6 py-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Bookmarks</h1>
              <p className="mt-1 text-sm text-slate-500">
                Saved items and bookmarked content will appear here.
              </p>
            </div>
            <Link
              href="/documents"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Back to documents
            </Link>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Loading bookmarks…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <svg className="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">No bookmarks yet</h2>
              <p className="mt-2 text-sm text-slate-500">
                Bookmark a chat message to save it here for quick access.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isSingleDocument = item.document_ids.length === 1;
                const openHref = isSingleDocument ? `/documents/${item.document_ids[0]}` : "/documents/multi";
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.session_title}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()} • {item.document_names.join(", ") || "No document metadata"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={openHref}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Open chat
                        </Link>
                        <button
                          type="button"
                          onClick={() => onRemove(item)}
                          disabled={removingMessageId === item.message_id}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {removingMessageId === item.message_id ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{item.snippet || "(empty message)"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}
