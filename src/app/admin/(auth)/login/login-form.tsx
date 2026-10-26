"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/auth";
import { adminApi } from "@/lib/admin-api";
import { Eye, EyeSlash, Leaf, LockKey } from "@/lib/icons";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    searchParams.get("reason") === "session-expired"
      ? "Your session ended. Sign in again to pick up where you left off."
      : null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      emailRef.current?.focus();
      return;
    }
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      // Uses the normal customer login endpoint (same HttpOnly cookie). The role
      // check below only decides where to send the browser; the server enforces
      // admin authorization on every admin API call.
      await authApi.login({ email: email.trim(), password });
      const identity = await adminApi.me();

      if (identity?.role === "ADMIN") {
        router.replace("/admin");
        return;
      }

      setNotice("This account is a customer account. The owner dashboard needs an admin account.");
      await authApi.logout();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Unable to sign in. Please try again.");
      // Keep the email so the owner only has to retype the password.
      emailRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-forest-800 text-leaf-200">
              <Leaf size={22} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-ink">Jay Hari Krushi Seva Kendra</p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-700">
                Owner dashboard
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm">
            <h1 className="font-display text-xl font-bold text-ink">Sign in</h1>
            <p className="mt-1 text-sm text-forest-800">
              Use the shop owner&apos;s account to manage orders, stock and inquiries.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-email" className="text-sm font-semibold text-ink">
                  Email
                </label>
                <input
                  ref={emailRef}
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "admin-login-error" : undefined}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-forest-800/20 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="admin-password" className="text-sm font-semibold text-ink">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "admin-login-error" : undefined}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-forest-800/20 bg-white px-3.5 py-2.5 pr-11 text-sm text-ink focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-forest-600 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                  >
                    {showPassword ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  id="admin-login-error"
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="rounded-lg border border-gold-300 bg-cream-100 px-3 py-2 text-sm text-ink">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
              >
                <LockKey size={16} weight="bold" aria-hidden="true" />
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-4 text-center text-xs text-forest-600">
            Shopping as a customer?{" "}
            <Link href="/login" className="font-semibold text-forest-800 underline-offset-2 hover:underline">
              Use the customer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
