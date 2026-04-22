"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { api, type Document, type User } from "@/lib/api";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loggedIn, setLoggedIn] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const showDocumentSearch = pathname === "/documents" || pathname.startsWith("/documents/");
  const searchQuery = search.trim();

  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    return documents.filter((document) =>
      document.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  const searchResults = filteredDocuments.slice(0, 8);

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    return [
      "inline-flex h-8 items-center justify-center rounded-xl px-4 text-sm font-semibold leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C2C55]/30",
      isActive
        ? "bg-[#0C2C55]/12 text-[#0C2C55] shadow-sm"
        : "text-zinc-700 hover:bg-[#0C2C55]/10 hover:text-[#0C2C55] active:bg-[#0C2C55]/15 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
    ].join(" ");
  };

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, [pathname]);

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
  }, [searchParams]);

  useEffect(() => {
    if (!loggedIn || !showDocumentSearch) return;
    let cancelled = false;
    api<Document[]>("/documents")
      .then((list) => {
        if (!cancelled) setDocuments(list);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, showDocumentSearch]);

  useEffect(() => {
    if (!loggedIn) {
      setMe(null);
      return;
    }
    let cancelled = false;
    api<User>("/auth/me")
      .then((user) => {
        if (!cancelled) setMe(user);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function setDocumentsSearch(value: string) {
    setSearch(value);
    setShowSearchDropdown(true);

    if (pathname !== "/documents") return;

    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    const query = params.toString();
    router.replace(query ? `/documents?${query}` : "/documents", { scroll: false });
  }

  function clearDocumentsSearch() {
    setSearch("");
    setShowSearchDropdown(false);
    if (pathname === "/documents") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("search");
      const query = params.toString();
      router.replace(query ? `/documents?${query}` : "/documents", { scroll: false });
    }
  }

  function renderHighlightedName(name: string, query: string) {
    const normalized = query.trim();
    if (!normalized) return name;
    const index = name.toLowerCase().indexOf(normalized.toLowerCase());
    if (index === -1) return name;
    return (
      <>
        {name.slice(0, index)}
        <mark className="rounded bg-amber-100 px-0.5 text-slate-900">{name.slice(index, index + normalized.length)}</mark>
        {name.slice(index + normalized.length)}
      </>
    );
  }

  function openDocument(documentId: string) {
    setShowSearchDropdown(false);
    router.push(`/documents/${documentId}`);
  }

  function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  function displayName(email: string | undefined): string {
    if (!email) return "User";
    const local = (email.split("@")[0] ?? "user").replace(/[^a-zA-Z\s]/g, "");
    return local.charAt(0).toUpperCase() + local.slice(1) || "User";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto grid max-w-[90rem] grid-cols-[auto_1fr_auto] items-center px-5 py-4 sm:px-6 lg:px-4 xl:px-6">

        {/* ── Col 1: Logo (left) ── */}
        <div className="flex items-center gap-2">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0C2C55] to-[#10386a] text-white shadow-md ring-1 ring-[#0C2C55]/20 transition duration-200 group-hover:scale-105 group-hover:shadow-lg">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.5 17a6.5 6.5 0 1 1 4.6-11.1A6.5 6.5 0 0 1 17 10.5c0 3.6-2.9 6.5-6.5 6.5Z" />
                <path d="m16.3 16.3 3.2 3.2" />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-[#0C2C55] to-[#10386a] bg-clip-text text-[17px] font-extrabold tracking-tight text-transparent transition group-hover:brightness-110">
              QueryBot
            </span>
          </Link>
        </div>
        <div className="hidden justify-center sm:flex">
          {loggedIn && showDocumentSearch && (
            <div ref={searchWrapRef} className="w-full max-w-xl">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="11" cy="11" r="8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onFocus={() => setShowSearchDropdown(true)}
                  onChange={(e) => setDocumentsSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-11 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition-colors focus:border-slate-300 focus:outline-none"
                />

                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearDocumentsSearch}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}

                {showSearchDropdown && searchQuery && (
                  <div className="absolute left-0 right-0 z-30 mt-2 rounded-lg border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Results</span>
                      <span className="rounded-full bg-[#0C2C55]/10 px-2 py-0.5 text-[10px] font-bold text-[#0C2C55]">
                        {filteredDocuments.length} found
                      </span>
                    </div>

                    {filteredDocuments.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="11" cy="11" r="8" />
                          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
                        </svg>
                        <p className="text-sm font-medium text-slate-400">No files match your search</p>
                        <p className="text-xs text-slate-300">Try a different keyword</p>
                      </div>
                    ) : (
                      <ul className="max-h-[340px] divide-y divide-slate-50 overflow-y-auto p-1.5">
                        {searchResults.map((document) => (
                          <li key={`nav-search-${document.id}`}>
                            <button
                              type="button"
                              onClick={() => openDocument(document.id)}
                              className="group/item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0C2C55] to-[#10386a]">
                                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {renderHighlightedName(document.original_filename, searchQuery)}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {(document.size_bytes / 1024).toFixed(1)} KB · {new Date(document.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="hidden rounded-lg bg-[#0C2C55] px-2.5 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover/item:inline-flex group-hover/item:opacity-100">
                                Open
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Col 3: Profile / Auth (right) ── */}
        <nav className="flex items-center justify-end gap-3 text-sm">
          {loggedIn ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50 focus-visible:outline-none"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0C2C55] to-[#10386a] text-xs font-bold text-white shadow-sm">
                  {displayName(me?.email).charAt(0)}
                </div>
                {/* Name: hidden on mobile/tablet, visible on desktop */}
                <span className="hidden truncate text-base font-semibold text-slate-900 md:block">
                  {displayName(me?.email)}
                </span>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full z-40 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                  {/* Name header in dropdown — always shown, prominent on mobile */}
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-xs text-slate-400">Signed in as</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{displayName(me?.email)}</p>
                  </div>
                  <Link href="/documents" className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                    </svg>
                    Documents
                  </Link>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link className={navLinkClass("/login")} href="/login">
                Log in
              </Link>
              <Link
                className="inline-flex h-8 items-center justify-center rounded-xl bg-gradient-to-r from-[#0C2C55] to-[#10386a] px-4 text-sm font-semibold leading-none text-white shadow-sm transition duration-200 hover:shadow-md hover:brightness-110 active:bg-[#0A2344] active:brightness-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C2C55]/30"
                href="/register"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
