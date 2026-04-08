"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type User } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptedTerms) {
      setError("Please accept Terms of Service and Privacy Policy.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      });
      const token = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      });
      setToken(token.access_token);
      router.push("/documents");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-14">
      <section className="mx-auto w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:p-10">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Create Account</h2>
            <p className="mt-2 text-slate-600">Start your free trial.</p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl bg-slate-100 px-6 py-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-slate-100 px-6 py-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl bg-slate-100 px-6 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-blue-700"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 rounded border-slate-300 bg-slate-100 text-blue-700 focus:ring-blue-200"
              />
              <label htmlFor="terms" className="text-sm leading-relaxed text-slate-600">
                I agree to the
                <a href="#" className="ml-1 font-semibold text-blue-700 hover:underline">
                  Terms of Service
                </a>
                and
                <a href="#" className="ml-1 font-semibold text-blue-700 hover:underline">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-blue-200 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create My Account"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?
            <Link href="/login" className="ml-1 font-bold text-blue-700 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
