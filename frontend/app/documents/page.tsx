"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, uploadDocument, type Document } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";

export default function DocumentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  useEffect(() => {
    function onOpen() { setIsOpen(true); }
    window.addEventListener("sidebar:open", onOpen);
    return () => window.removeEventListener("sidebar:open", onOpen);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api<Document[]>("/documents");
      setDocs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    await handleFile(file);
    e.target.value = "";
  }

  async function deleteDocument(document: Document) {
    const ok = window.confirm(`Delete "${document.original_filename}"? This cannot be undone.`);
    if (!ok) return;
    setError(null);
    try {
      await api<void>(`/documents/${document.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  }

  function extensionOf(filename: string): string {
    const ext = filename.split(".").pop();
    return ext ? ext.toUpperCase() : "FILE";
  }

  const searchQuery = (searchParams.get("search") ?? "").trim();
  const filteredFiles = docs.filter((file) =>
    file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sidebarLinkClass = (href: string) => {
    const isActive = pathname === href;
    return [
      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition",
      isActive
        ? "bg-[#0C2C55]/8 font-semibold text-[#0C2C55]"
        : "font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900",
    ].join(" ");
  };

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-slate-50">
        {/* ── Backdrop (mobile only) ── */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* ── Sidebar ── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex h-full w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
            isOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
          }`}
        >
          {/* Close button — mobile only */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 lg:hidden">
            <span className="text-sm font-semibold text-slate-700">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Search — mobile only (header search is hidden on small screens) */}
          <div className="border-b border-slate-100 px-3 py-3 lg:hidden">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
              </span>
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search documents..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => setSidebarSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Inline results */}
            {sidebarSearch.trim() && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                {docs.filter((d) =>
                  d.original_filename.toLowerCase().includes(sidebarSearch.trim().toLowerCase())
                ).length === 0 ? (
                  <p className="px-4 py-3 text-xs text-slate-400">No documents found</p>
                ) : (
                  <ul className="max-h-52 divide-y divide-slate-50 overflow-y-auto">
                    {docs
                      .filter((d) =>
                        d.original_filename.toLowerCase().includes(sidebarSearch.trim().toLowerCase())
                      )
                      .slice(0, 8)
                      .map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => { router.push(`/documents/${d.id}`); setIsOpen(false); setSidebarSearch(""); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#0C2C55] to-[#10386a]">
                              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="truncate text-sm font-medium text-slate-800">{d.original_filename}</span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Nav links */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/"
              className={sidebarLinkClass("/")}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              Home
            </Link>
            <Link
              href="/documents"
              className={sidebarLinkClass("/documents")}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Documents
            </Link>
            <Link
              href="/documents/multi"
              className={sidebarLinkClass("/documents/multi")}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Multi-document chat
            </Link>
            <Link
              href="/documents/bookmarks"
              className={sidebarLinkClass("/documents/bookmarks")}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              Bookmarks
            </Link>
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="min-w-0 flex-1 overflow-y-auto">

          {/* ── Mobile sub-header: hamburger + QueryBot brand (hidden on desktop) ── */}
          <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setIsOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-base font-bold tracking-tight text-[#0C2C55]"></span>
          </div>

          <div className="mx-auto max-w-6xl space-y-8 px-6 py-6 lg:px-10 lg:py-8">
            <section className="space-y-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Documents Library</h1>
                  <p className="text-sm text-slate-500">
                    Manage your knowledge base and interact with your AI assistant.
                  </p>
                </div>
                <Link
                  href="/documents/multi"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0C2C55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10386a]"
                >
                  Multi-document chat
                </Link>
              </div>
            </section>

            {/* Upload */}
            <section
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                drag ? "border-[#0C2C55] bg-[#0C2C55]/5" : "border-slate-200 bg-white"
              }`}
            >
              <label className="flex cursor-pointer flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                  <svg className="h-6 w-6 text-[#0C2C55]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {uploading ? "Uploading..." : "Upload Documents"}
                </span>
                <span className="text-xs text-slate-400">Drag & drop or click · PDF, DOCX, TXT</span>
                <input type="file" accept=".pdf,.docx,.txt" className="hidden" disabled={uploading} onChange={onFile} />
              </label>
            </section>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Files Table */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">All Files</h2>
                <p className="text-xs font-medium text-slate-400">
                  {searchQuery
                    ? `${filteredFiles.length} result${filteredFiles.length !== 1 ? "s" : ""}`
                    : `${docs.length} document${docs.length !== 1 ? "s" : ""}`}
                </p>
              </div>

              {docs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-slate-400">No documents yet</p>
                  <p className="text-xs text-slate-300">Upload a file to get started</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                  <p className="text-sm font-medium text-slate-400">No documents match your search</p>
                  <p className="text-xs text-slate-300">Use the top header search to try another filename</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#0C2C55] to-[#10386a]">
                        <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-white/90">File Name</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Type</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Size</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-white/90">Uploaded</th>
                        <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-white/90">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredFiles.map((d, i) => (
                        <tr key={d.id} className={`transition-colors hover:bg-[#0C2C55]/[0.03] ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0C2C55] to-[#10386a]">
                                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <Link href={`/documents/${d.id}`} className="truncate text-sm font-semibold text-slate-900 hover:text-[#0C2C55] hover:underline">
                                {d.original_filename}
                              </Link>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex rounded-md bg-[#0C2C55]/10 px-2 py-0.5 text-[10px] font-bold text-[#0C2C55]">
                              {extensionOf(d.original_filename)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-500">{(d.size_bytes / 1024).toFixed(1)} KB</td>
                          <td className="px-5 py-3.5 text-sm text-slate-400">{new Date(d.created_at).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              <Link
                                href={`/documents/${d.id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C2C55] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#10386a] hover:shadow-md"
                              >
                                Open
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                              <button
                                type="button"
                                onClick={() => void deleteDocument(d)}
                                aria-label={`Delete ${d.original_filename}`}
                                title="Delete document"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-black transition hover:border-black hover:bg-slate-50"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18" strokeLinecap="round" />
                                  <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
