"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";

export default function BookmarksPage() {
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

          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">No bookmarks yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Bookmark support in chat is visible in the UI, but a dedicated saved bookmarks list has not been wired to persistent storage yet.
            </p>
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}
