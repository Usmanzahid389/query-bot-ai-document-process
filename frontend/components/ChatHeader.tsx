"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatSession } from "@/lib/api";

interface ChatHeaderProps {
  title: string;
  sessions: ChatSession[];
  sessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onNewChat: () => void;
  onDeleteSession?: (id: string) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
}

function formatSessionDate(isoString: string) {
  const date = new Date(isoString);
  return (
    date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " • " +
    date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

export function ChatHeader({
  title,
  sessions,
  sessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
}: ChatHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  const filteredSessions = search.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
    : sessions;

  return (
    <>
      {/* ── Header bar ─────────────────────────────────────────── */}
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
        <button
          type="button"
          aria-label="Open chat history"
          onClick={() => setSidebarOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <span className="pointer-events-none absolute inset-x-0 flex justify-center">
          <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-zinc-100">{title}</span>
        </span>

        <button
          type="button"
          aria-label="New chat"
          onClick={onNewChat}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      {/* ── Backdrop ────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/50 ${
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ── Slide-over sidebar ──────────────────────────────────── */}
      <div
        ref={sidebarRef}
        style={{ width: "270px" }}
        className={`fixed bottom-0 left-0 top-0 z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-zinc-900 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <span className="text-[15px] font-semibold text-slate-800 dark:text-zinc-100">Chat History</span>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* New Chat button */}
        <div className="shrink-0 px-3 pb-3">
          <button
            type="button"
            onClick={() => { onNewChat(); setSidebarOpen(false); }}
            className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Search input */}
        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {filteredSessions.length > 0 && (
            <>
              <p className="mb-1 mt-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Recents
              </p>
              <div className="space-y-0.5">
                {filteredSessions.map((s) => (
                  <SidebarItem
                    key={s.id}
                    session={s}
                    active={sessionId === s.id}
                    onSelect={() => { onSelectSession(s.id); setSidebarOpen(false); }}
                    onDelete={onDeleteSession ? () => onDeleteSession(s.id) : undefined}
                    onRename={onRenameSession ? (t) => onRenameSession(s.id, t) : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {filteredSessions.length === 0 && (
            <p className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-600">
              {search.trim() ? "No chats match your search" : "No chat history yet"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Sidebar list item ─────────────────────────────────────────── */
interface SidebarItemProps {
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onRename?: (newTitle: string) => void;
}

function SidebarItem({ session, active, onSelect, onDelete, onRename }: SidebarItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  const displayTitle = session.title.replace(/^Chat\s*[—-]\s*/i, "").trim() || session.title;

  function startRename() {
    setRenameValue(displayTitle);
    setRenaming(true);
    setMenuOpen(false);
  }

  function commitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== displayTitle && onRename) {
      onRename(trimmed);
    }
    setRenaming(false);
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-zinc-800">
        <input
          ref={renameInputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
            if (e.key === "Escape") { e.preventDefault(); setRenaming(false); }
          }}
          onBlur={commitRename}
          className="min-w-0 flex-1 rounded bg-white px-2 py-1 text-[13px] text-slate-800 outline-none ring-1 ring-[#0C2C55]/30 dark:bg-zinc-700 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={commitRename}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-green-600 transition hover:bg-green-50 dark:hover:bg-green-900/20"
          aria-label="Save rename"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setRenaming(false)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 dark:hover:bg-zinc-700"
          aria-label="Cancel rename"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded-lg transition-colors duration-150 ${
        active ? "bg-[#0C2C55]/10 dark:bg-zinc-800" : "hover:bg-slate-100 dark:hover:bg-zinc-800/60"
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 px-3 py-2 text-left">
        <span
          className={`block truncate text-[13.5px] font-medium leading-snug ${
            active ? "text-[#0C2C55] dark:text-zinc-100" : "text-slate-700 dark:text-zinc-200"
          }`}
        >
          {displayTitle}
        </span>
        <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-zinc-500">
          {formatSessionDate(session.created_at)}
        </span>
      </button>

      {/* 3-dot menu */}
      <div ref={menuRef} className="relative mr-1.5 shrink-0">
        <button
          type="button"
          aria-label="More options"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p); }}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 ${
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); startRename(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Rename
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}