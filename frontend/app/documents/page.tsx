"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearToken } from "@/lib/auth";
import { api, uploadDocument, type Document, type User } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<Document[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

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
      .then((u) => { if (mounted) setMe(u); })
      .catch(() => { if (mounted) setMe(null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
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

  function displayName(email: string | undefined): string {
    if (!email) return "User";
    const local = email.split("@")[0] ?? "user";
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  const searchQuery = (searchParams.get("search") ?? "").trim();
  const filteredFiles = docs.filter((file) =>
    file.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-slate-50">
        {/* ── Sidebar ── */}
        <aside className="sticky top-0 flex h-screen w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white">
          {/* Nav links */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              Home
            </Link>
            <Link
              href="/documents"
              className="flex items-center gap-3 rounded-xl bg-[#0C2C55]/8 px-4 py-2.5 text-sm font-semibold text-[#0C2C55]"
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Documents
            </Link>
          </nav>

          {/* Profile card */}
          <div ref={profileRef} className="relative border-t border-slate-100 px-3 py-4">
            <button
              type="button"
              onClick={() => setShowProfileMenu((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0C2C55] to-[#10386a] text-xs font-bold text-white shadow-sm">
                {displayName(me?.email).charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName(me?.email)}</p>
                <p className="truncate text-xs text-slate-400">{me?.email ?? "Signed in"}</p>
              </div>
              <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v.01M12 12v.01M12 19v.01" strokeLinecap="round" />
              </svg>
            </button>

            {showProfileMenu && (
              <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Profile
                </button>
                <button type="button" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                  Settings
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button type="button" onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 lg:px-10">
            <section className="space-y-1">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Documents Library</h1>
              <p className="text-sm text-slate-500">
                Manage your knowledge base and interact with your AI assistant.
              </p>
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
                  <table className="w-full">
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
                            <Link
                              href={`/documents/${d.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C2C55] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#10386a] hover:shadow-md"
                            >
                              Open
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
