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
      "rounded-full px-3 py-1.5 text-sm font-medium transition-all",
      isActive
        ? "bg-blue-100 text-blue-700"
        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
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
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/90 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
        <Link
          href="/"
          className="bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent"
        >
          QueryBot
        </Link>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          {loggedIn ? (
            <>
              <Link className={navLinkClass("/documents")} href="/documents">
                Documents
              </Link>
              <Link className={navLinkClass("/compare")} href="/compare">
                Compare
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-900"
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
                className="rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-1.5 font-semibold text-white shadow-sm transition hover:opacity-90"
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
