"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  adminApi,
  AdminApiError,
  setSessionExpiredListener,
  type AdminIdentity,
} from "../../lib/admin-api";
import { PageLoadingSkeleton } from "../ui/skeleton";

type AdminAuthState =
  | { status: "loading" }
  | { status: "forbidden" }
  | { status: "error"; message: string }
  | { status: "ready"; admin: AdminIdentity };

type AdminAuthContextValue = {
  admin: AdminIdentity;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  }
  return context;
}

/**
 * One-shot flag: set when an admin request returned 401, so the sign-in page can
 * explain why and so a burst of failing requests redirects only once.
 */
let expiredDuringThisPage = false;

const SIGN_IN_REASON = "session-expired";

/**
 * UX route guard only: it asks the backend who the current session is
 * (`GET /api/auth/me`, HttpOnly cookie) and requires `role === "ADMIN"`.
 * Every protected action is re-checked server-side, so this never grants access.
 */
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<AdminAuthState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    adminApi
      .me()
      .then((identity) => {
        if (!active) return;
        if (!identity) {
          // A 401 here is the expected "signed out" case unless an admin request
          // already reported an expiry, in which case the login page explains it.
          const reason = expiredDuringThisPage ? `?reason=${SIGN_IN_REASON}` : "";
          router.replace(`/admin/login${reason}`);
          return;
        }
        if (identity.role !== "ADMIN") {
          setState({ status: "forbidden" });
          return;
        }
        setState({ status: "ready", admin: identity });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message:
            error instanceof AdminApiError && error.status === 0
              ? "We couldn't reach the server to verify your session. Check your connection and try again."
              : "We couldn't verify your admin session. Please try again.",
        });
      });

    return () => {
      active = false;
    };
  }, [router, reloadKey]);

  const sessionExpired = useCallback(() => {
    router.replace(`/admin/login?reason=${SIGN_IN_REASON}`);
  }, [router]);

  useEffect(() => {
    setSessionExpiredListener(() => {
      if (expiredDuringThisPage) return;
      expiredDuringThisPage = true;
      sessionExpired();
    });
    return () => setSessionExpiredListener(null);
  }, [sessionExpired]);

  // Clear the one-shot flag when the login page is shown again.
  useEffect(() => {
    if (pathname === "/admin/login") expiredDuringThisPage = false;
  }, [pathname]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Signing out is best-effort: the cookie may already be gone.
    } finally {
      expiredDuringThisPage = false;
      router.replace("/admin/login");
    }
  }

  if (state.status === "ready") {
    return (
      <AdminAuthContext.Provider
        value={{ admin: state.admin, signOut }}
      >
        {children}
      </AdminAuthContext.Provider>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-forest-800/10 bg-white p-8 text-center shadow-sm">
          <h1 className="font-display text-xl font-bold text-ink">Owner access required</h1>
          <p className="mt-2 text-sm leading-relaxed text-forest-800">
            You&apos;re signed in with a customer account. The dashboard is only available to the
            shop owner&apos;s account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/admin/login"
              className="rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              Use a different account
            </a>
            <a
              href="/account"
              className="rounded-full px-5 py-2 text-sm font-semibold text-forest-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              Back to my account
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream-50 px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
        >
          <h1 className="font-display text-xl font-bold text-ink">Couldn&apos;t verify access</h1>
          <p className="mt-2 text-sm text-forest-800">{state.message}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-6 rounded-full border border-forest-800/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <PageLoadingSkeleton />;
}
