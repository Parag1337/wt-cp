import { Suspense } from "react";
import type { Metadata } from "next";
import AdminLoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Owner Sign In",
};

/**
 * Public sign-in route: no session guard, no dashboard shell.
 * `AdminLoginForm` reads `?reason=session-expired`, so it sits in a Suspense
 * boundary (Next.js docs: useSearchParams → Suspense), keeping the route prerenderable.
 */
export default function AdminLoginRoute() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
