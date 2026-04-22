"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { api, type User } from "@/lib/api";
import { setToken } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HAS_SPECIAL_RE = /[^A-Za-z0-9]/;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setTermsError(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    if (!HAS_SPECIAL_RE.test(password)) {
      setPasswordError("Password must include at least 1 special character.");
      return;
    }
    if (!acceptedTerms) {
      setTermsError("Please accept Terms of Service and Privacy Policy.");
      return;
    }
    setLoading(true);
    try {
      await api<User>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
        token: null,
      });
      const token = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
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

          <form noValidate onSubmit={onSubmit} className="space-y-6">
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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
                onChange={(e) => {
                  const v = e.target.value;
                  setEmail(v);
                  const normalized = v.trim().toLowerCase();
                  if (!normalized) {
                    setEmailError(null);
                  } else if (!EMAIL_RE.test(normalized)) {
                    setEmailError("Please enter a valid email address.");
                  } else {
                    setEmailError(null);
                  }
                }}
                className="w-full rounded-xl bg-slate-100 px-6 py-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              {emailError && <p className="text-sm text-red-600">{emailError}</p>}
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
                  onChange={(e) => {
                    const v = e.target.value;
                    setPassword(v);
                    if (!v) {
                      setPasswordError(null);
                    } else if (v.length < 8) {
                      setPasswordError("Password must be at least 8 characters long.");
                    } else if (!HAS_SPECIAL_RE.test(v)) {
                      setPasswordError("Password must include at least 1 special character.");
                    } else {
                      setPasswordError(null);
                    }
                  }}
                  className="w-full rounded-xl bg-slate-100 px-6 py-4 pr-12 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-blue-700"
                >
                  {showPassword ? (
                    <Eye className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                  ) : (
                    <EyeOff className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                  )}
                </button>
              </div>
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            </div>

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAcceptedTerms(checked);
                  if (termsError && checked) {
                    setTermsError(null);
                  }
                }}
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
            {termsError && <p className="text-sm text-red-600">{termsError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-br from-[#0C2C55] to-[#10386a] px-5 py-3 text-base font-bold text-white shadow-lg shadow-[#0C2C55]/25 transition duration-200 hover:brightness-110 active:scale-[0.98] active:brightness-100 disabled:cursor-not-allowed disabled:opacity-60"
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
