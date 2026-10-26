"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { CustomerHeader } from "../components/customer-header";
import { useAuth } from "../lib/auth-context";
import { PageLoadingSkeleton } from "./ui/skeleton";

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "guest") {
      const redirect = encodeURIComponent(pathname);
      router.push(`/login?redirect=${redirect}`);
    }
  }, [status, router, pathname]);

  if (status === "loading" || status === "guest") {
    return <PageLoadingSkeleton />;
  }

  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <CustomerHeader />
      <main className="flex-1 pt-16 lg:pt-20">
        {children}
      </main>
    </>
  );
}
