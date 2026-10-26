"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, SignOut, User } from "../../lib/icons";
import { useAuth } from "../../lib/auth-context";
import { Button } from "../button";
import { AuthShell } from "./auth-shell";

const DETAILS = [
  { key: "Name", valueKey: "fullName" },
  { key: "Email", valueKey: "email" },
  { key: "Phone", valueKey: "phone" },
] as const;

export function AccountCard() {
  const router = useRouter();
  const { status, customer, logout } = useAuth();

  useEffect(() => {
    if (status === "guest") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <AuthShell>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-forest-800/10 bg-white p-12 text-center shadow-md">
          <span className="flex size-12 animate-pulse items-center justify-center rounded-2xl bg-forest-800 text-gold-400">
            <Leaf size={24} weight="fill" aria-hidden="true" />
          </span>
          <p className="text-sm text-forest-800">Loading your account...</p>
        </div>
      </AuthShell>
    );
  }

  if (status === "guest" || !customer) {
    return null;
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <AuthShell>
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-forest-800 text-gold-400">
          <User size={24} weight="bold" aria-hidden="true" />
        </span>
        <p className="mt-5 text-sm font-semibold text-forest-700">
          Welcome back,
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {customer.fullName}
        </h2>
      </div>

      <div className="mt-6 rounded-2xl border border-forest-800/10 bg-white p-6 shadow-md md:p-8">
        <h3 className="font-display text-lg font-bold text-ink">
          Your Account
        </h3>
        <dl className="mt-5 divide-y divide-forest-800/5">
          {DETAILS.map((detail) => (
            <div
              key={detail.key}
              className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <dt className="text-sm font-semibold text-forest-800">
                {detail.key}
              </dt>
              <dd className="text-base text-ink sm:text-right">
                {customer[detail.valueKey]}
              </dd>
            </div>
          ))}
        </dl>

        <Button
          variant="outline"
          size="lg"
          className="mt-6 w-full"
          onClick={() => void handleLogout()}
        >
          <SignOut size={18} weight="bold" aria-hidden="true" />
          Logout
        </Button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
        >
          Back to Home
        </Link>
      </div>
    </AuthShell>
  );
}