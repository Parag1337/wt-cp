"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { PageLoadingSkeleton } from "../../components/ui/skeleton";

export default function AccountRedirect() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/profile");
    } else if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <PageLoadingSkeleton />;
  }

  return null;
}
