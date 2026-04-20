"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatSession } from "@/lib/api";

interface ChatHeaderProps {
  title: string;
  sessions: ChatSession[];
  sessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onNewChat: () => void;
}

export function ChatHeader({
  title,
  sessions,
  sessionId,
  onSelectSession,
  onNewChat,
}: ChatHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem("chat_favorites");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close sidebar on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [sidebarOpen]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem("chat_favorites", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const isFav = sessionId ? favorites.has(sessionId) : false;

  const favSessions = sessions.filter((s) => favorites.has(s.id));
  const otherSessions = sessions.filter((s) => !favorites.has(s.id));

  return (
    <>
      {/* ── Header bar ─────────────────────────────────────────── */}
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Left */}
        <div className="flex items-center gap-1.5">
          {/* Hamburger */}
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

          {/* Bookmark/Star */}
          <button
            type="button"
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            disabled={!sessionId}
            onClick={() => sessionId && toggleFavorite(sessionId)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
              isFav
                ? "text-amber-400 hover:text-amber-500"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill={isFav ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Center title */}
        <span className="pointer-events-none absolute inset-x-0 flex justify-center">
          <span className="text-sm font-semibold tracking-tight text-slate-800 dark:text-zinc-100">
            {title}
          </span>
        </span>

        {/* Right — new chat pencil */}
        <button
          type="button"
          aria-label="New chat"
          onClick={onNewChat}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
            <path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      {/* ── Backdrop ────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/40 ${
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ── Slide-over sidebar ──────────────────────────────────── */}
      <div
        ref={sidebarRef}
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-zinc-900 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-zinc-800">
          <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100">Chat history</span>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* New thread button */}
        <div className="shrink-0 px-3 pt-3">
          <button
            type="button"
            onClick={() => {
              onSelectSession(null);
              setSidebarOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#0C2C55] transition hover:bg-[#0C2C55]/8 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#0C2C55]/10 text-[#0C2C55] dark:bg-zinc-800">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
            New thread
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {/* Favorites */}
          {favSessions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                Starred
              </p>
              <div className="space-y-0.5">
                {favSessions.map((s) => (
                  <SidebarItem
                    key={s.id}
                    session={s}
                    active={sessionId === s.id}
                    isFav
                    onSelect={() => {
                      onSelectSession(s.id);
                      setSidebarOpen(false);
                    }}
                    onToggleFav={() => toggleFavorite(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All other sessions */}
          {otherSessions.length > 0 && (
            <div>
              {favSessions.length > 0 && (
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                  All chats
                </p>
              )}
              <div className="space-y-0.5">
                {otherSessions.map((s) => (
                  <SidebarItem
                    key={s.id}
                    session={s}
                    active={sessionId === s.id}
                    isFav={false}
                    onSelect={() => {
                      onSelectSession(s.id);
                      setSidebarOpen(false);
                    }}
                    onToggleFav={() => toggleFavorite(s.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <p className="mt-6 text-center text-xs text-slate-400 dark:text-zinc-600">No chat history yet</p>
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
  isFav: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}

function SidebarItem({ session, active, isFav, onSelect, onToggleFav }: SidebarItemProps) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg transition ${
        active ? "bg-[#0C2C55]/10 dark:bg-zinc-800" : "hover:bg-slate-100 dark:hover:bg-zinc-800/70"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 px-3 py-2.5 text-left"
      >
        <span
          className={`block truncate text-sm font-medium ${
            active ? "text-[#0C2C55] dark:text-zinc-100" : "text-slate-700 dark:text-zinc-200"
          }`}
        >
          {session.title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400 dark:text-zinc-500">
          {new Date(session.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </button>

      {/* Star toggle inside item */}
      <button
        type="button"
        aria-label={isFav ? "Unstar" : "Star"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition ${
          isFav
            ? "text-amber-400 hover:text-amber-500"
            : "text-transparent group-hover:text-slate-300 hover:!text-amber-400 dark:group-hover:text-zinc-600"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill={isFav ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
