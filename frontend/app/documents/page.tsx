"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearToken } from "@/lib/auth";
import { api, uploadDocument, type Document, type User } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";

export default function DocumentsPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    let mounted = true;
    api<User>("/auth/me")
      .then((u) => {
        if (mounted) setMe(u);
      })
      .catch(() => {
        if (mounted) setMe(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

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

  function displayNameFromEmail(email: string | undefined): string {
    if (!email) return "QueryBot User";
    const local = email.split("@")[0] ?? "user";
    if (!local) return "QueryBot User";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  const searchQuery = search.trim();
  const filteredFiles = docs.filter((file) =>
    file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const showSearchResults = searchQuery.length > 0;
  const searchResults = filteredFiles.slice(0, 8);

  function renderHighlightedName(name: string, query: string) {
    const q = query.trim();
    if (!q) return name;
    const lowerName = name.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerName.indexOf(lowerQ);
    if (idx === -1) return name;

    const start = name.slice(0, idx);
    const match = name.slice(idx, idx + q.length);
    const end = name.slice(idx + q.length);

    return (
      <>
        {start}
        <mark className="rounded bg-blue-100 px-0.5 text-slate-900">{match}</mark>
        {end}
      </>
    );
  }

  return (
    <RequireAuth>
      <div className="mx-auto grid w-full max-w-[1600px] gap-6 pb-12 pl-0 pr-4 pt-0 sm:pl-0 sm:pr-6 lg:min-h-[calc(100vh-84px)] lg:grid-cols-[20%_80%] lg:gap-0 lg:pl-0 lg:pr-8 lg:pb-0 lg:pt-0">
        <aside className="flex h-fit flex-col rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:px-6 lg:shadow-none">
          <div className="space-y-1">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>◻</span>
              <span>Dashboard</span>
            </Link>
            <Link
              href="/documents"
              className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
            >
              <span>▣</span>
              <span>Documents</span>
            </Link>
            <Link
              href="/compare"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <span>◫</span>
              <span>Compare</span>
            </Link>
          </div>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                {displayNameFromEmail(me?.email).charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{displayNameFromEmail(me?.email)}</p>
                <p className="truncate text-xs text-slate-500">{me?.email ?? "Signed in"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="space-y-8 px-4 py-6 lg:px-10 lg:py-8">
          <section className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Documents Library</h1>
            <p className="text-base text-slate-600">
              Manage your knowledge base and interact with your AI assistant.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label htmlFor="doc-search" className="mb-2 block text-sm font-semibold text-slate-700">
              Search PDFs and documents
            </label>
            <div ref={searchWrapRef} className="relative">
              <input
                id="doc-search"
                type="text"
                value={search}
                onFocus={() => setShowSearchDropdown(true)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSearchDropdown(true);
                }}
                placeholder="Search by file name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              {showSearchResults && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setShowSearchDropdown(false);
                  }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  ✕
                </button>
              )}

              {showSearchDropdown && showSearchResults && (
                <div className="absolute left-0 right-0 z-30 mt-2 origin-top rounded-2xl border border-slate-200 bg-white p-2 shadow-xl transition-all duration-200 ease-out">
                  <div className="mb-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search Results
                  </div>

                  {filteredFiles.length === 0 ? (
                    <div className="rounded-xl px-3 py-3 text-sm text-slate-500">No files found</div>
                  ) : (
                    <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                      {searchResults.map((d) => (
                        <li key={`dropdown-${d.id}`}>
                          <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base" aria-hidden>
                                  📄
                                </span>
                                <Link
                                  href={`/documents/${d.id}`}
                                  onClick={() => setShowSearchDropdown(false)}
                                  className="truncate text-sm font-semibold text-slate-900 hover:underline"
                                >
                                  {renderHighlightedName(d.original_filename, searchQuery)}
                                </Link>
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {(d.size_bytes / 1024).toFixed(1)} KB · {new Date(d.created_at).toLocaleDateString()}
                              </p>
                            </div>

                            <Link
                              href={`/documents/${d.id}`}
                              onClick={() => setShowSearchDropdown(false)}
                              className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-blue-600 hover:text-white"
                            >
                              Open chat
                            </Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
              drag
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-gradient-to-b from-slate-100 to-white"
            }`}
          >
            <label className="flex cursor-pointer flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
                <span className="text-2xl">↑</span>
              </div>
              <span className="text-base font-semibold text-slate-900">
                {uploading ? "Uploading..." : "Upload New Documents"}
              </span>
              <span className="text-sm text-slate-600">Drag and drop your files here or click to browse</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={uploading}
                onChange={onFile}
              />
              <span className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                {uploading ? "Please wait..." : "Upload File"}
              </span>
              <span className="text-xs text-slate-500">Supported: .pdf, .docx, .txt</span>
            </label>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">All Files</h2>
              <p className="text-sm font-medium text-slate-500">Last uploaded first</p>
            </div>

            {docs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                No documents yet.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {docs.map((d) => (
                  <li
                    key={d.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                        {extensionOf(d.original_filename)}
                      </div>
                      <span className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>

                    <Link
                      href={`/documents/${d.id}`}
                      className="line-clamp-1 text-lg font-bold text-slate-900 underline-offset-4 hover:underline"
                    >
                      {d.original_filename}
                    </Link>

                    <p className="mt-2 text-sm text-slate-500">{(d.size_bytes / 1024).toFixed(1)} KB</p>

                    <Link
                      href={`/documents/${d.id}`}
                      className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition group-hover:bg-blue-600 group-hover:text-white"
                    >
                      Open chat
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </RequireAuth>
  );
}
