"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken } from "@/lib/auth";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  const navLinkClass = (href: string) => {
    const isActive = pathname === href;
    return [
      "inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold leading-none transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C2C55]/30",
      isActive
        ? "bg-[#0C2C55]/12 text-[#0C2C55] shadow-sm"
        : "text-zinc-700 hover:bg-[#0C2C55]/10 hover:text-[#0C2C55] active:bg-[#0C2C55]/15 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
    ].join(" ");
  };

  useEffect(() => {
    setLoggedIn(!!getToken());
  }, [pathname]);

  function logout() {
    clearToken();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-5 py-5 sm:px-6 lg:px-4 xl:px-6">
        <Link href="/" className="group inline-flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#0C2C55] to-[#10386a] text-white shadow-md ring-1 ring-[#0C2C55]/20 transition duration-200 group-hover:scale-105 group-hover:shadow-lg">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.5 17a6.5 6.5 0 1 1 4.6-11.1A6.5 6.5 0 0 1 17 10.5c0 3.6-2.9 6.5-6.5 6.5Z" />
              <path d="m16.3 16.3 3.2 3.2" />
            </svg>
          </span>
          <span className="bg-gradient-to-r from-[#0C2C55] to-[#10386a] bg-clip-text text-xl font-extrabold tracking-tight text-transparent transition group-hover:brightness-110">
            QueryBot
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {loggedIn ? (
            <>
              <Link className={navLinkClass("/documents")} href="/documents">
                Documents
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition duration-200 hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C2C55]/30 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link className={navLinkClass("/login")} href="/login">
                Log in
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-[#0C2C55] to-[#10386a] px-5 text-sm font-semibold leading-none text-white shadow-sm transition duration-200 hover:shadow-md hover:brightness-110 active:bg-[#0A2344] active:brightness-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0C2C55]/30"
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
