"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { authApi } from "../../lib/auth";
import { PageHeader } from "../../components/ui/page-header";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/button";
import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Eye,
  EyeSlash,
  LockKey,
  Phone,
  SignOut,
  Storefront,
  User,
  WarningCircle,
} from "../../lib/icons";

function ProfileSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Loading your profile</span>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="mt-8 space-y-4 border-t border-forest-800/5 pt-6">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ProfileContent() {
  const router = useRouter();
  const { customer, status, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  if (status === "loading" || !customer) {
    return <ProfileSkeleton />;
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handlePasswordChange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }

    setPwSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess("Password updated successfully.");
    } catch (error) {
      setPwError(
        error instanceof Error ? error.message : "Couldn't update your password."
      );
    } finally {
      setPwSaving(false);
    }
  }

  const actions = [
    {
      href: "/shop",
      label: "Continue Shopping",
      description: "Browse the latest seeds, fertilisers and more",
      icon: <Storefront size={22} weight="bold" aria-hidden="true" />,
    },
    {
      href: "/orders",
      label: "View Orders",
      description: "Check your order history and status",
      icon: <ClipboardText size={22} weight="bold" aria-hidden="true" />,
    },
    {
      href: "/contact",
      label: "Contact Us",
      description: "Need help? Get in touch with the store",
      icon: <Phone size={22} weight="bold" aria-hidden="true" />,
    },
  ];

  return (
    <>
      <PageHeader eyebrow="My Account" title="My Profile" />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center rounded-full bg-forest-800 text-gold-400">
                    <User size={28} weight="bold" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold text-ink">
                      {customer.fullName}
                    </h2>
                    <p className="text-sm text-forest-700">Customer</p>
                  </div>
                </div>

                <h3 className="mt-8 font-display text-base font-bold text-ink">
                  Profile Information
                </h3>
                <dl className="mt-3 divide-y divide-forest-800/5">
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Full Name
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.fullName}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Email Address
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.email}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Phone Number
                    </dt>
                    <dd className="text-base text-ink sm:text-right">
                      {customer.phone}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <dt className="text-sm font-semibold text-forest-800">
                      Password
                    </dt>
                    <dd className="text-base text-ink sm:text-right" aria-label="Password saved">
                      ••••••••
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-forest-800/5 text-forest-700">
                    <LockKey size={22} weight="bold" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-bold text-ink">
                      Change Password
                    </h3>
                    <p className="text-xs text-forest-600">
                      Your password is stored securely and can&apos;t be displayed.
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePasswordChange} className="mt-5 grid gap-4">
                  <div>
                    <label
                      htmlFor="pw-current"
                      className="mb-1.5 block text-sm font-semibold text-forest-800"
                    >
                      Current password
                    </label>
                    <div className="relative">
                      <input
                        id="pw-current"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="w-full rounded-xl border border-forest-800/20 bg-white py-2.5 pl-4 pr-11 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((s) => !s)}
                        aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-500 hover:text-forest-800"
                      >
                        {showPasswords ? (
                          <EyeSlash size={18} aria-hidden="true" />
                        ) : (
                          <Eye size={18} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="pw-new"
                        className="mb-1.5 block text-sm font-semibold text-forest-800"
                      >
                        New password
                      </label>
                      <input
                        id="pw-new"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full rounded-xl border border-forest-800/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="pw-confirm"
                        className="mb-1.5 block text-sm font-semibold text-forest-800"
                      >
                        Confirm new password
                      </label>
                      <input
                        id="pw-confirm"
                        type={showPasswords ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full rounded-xl border border-forest-800/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
                      />
                    </div>
                  </div>

                  {pwError && (
                    <p
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                      <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{pwError}</span>
                    </p>
                  )}
                  {pwSuccess && (
                    <p
                      role="status"
                      className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                    >
                      <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{pwSuccess}</span>
                    </p>
                  )}

                  <div>
                    <Button type="submit" disabled={pwSaving}>
                      {pwSaving ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            <aside>
              <h3 className="mb-3 font-display text-base font-bold text-ink">
                Quick Actions
              </h3>
              <nav aria-label="Quick actions" className="space-y-3">
                {actions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    className="group flex items-center gap-4 rounded-xl border border-forest-800/10 bg-white p-4 shadow-sm transition-colors hover:border-forest-800/25 hover:bg-forest-50"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-forest-800/5 text-forest-700 transition-colors group-hover:bg-forest-800 group-hover:text-gold-400">
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {action.label}
                      </span>
                      <span className="block truncate text-xs text-forest-600">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight
                      size={18}
                      weight="bold"
                      aria-hidden="true"
                      className="text-forest-500 transition-transform group-hover:translate-x-0.5"
                    />
                  </a>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-4 rounded-xl border border-forest-800/10 bg-white p-4 text-left shadow-sm transition-colors hover:border-red-600/30 hover:bg-red-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                    <SignOut size={22} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      Log Out
                    </span>
                    <span className="block truncate text-xs text-forest-600">
                      Sign out of your account
                    </span>
                  </span>
                </button>
              </nav>

              <div className="mt-6 rounded-xl bg-forest-800 p-5 text-gold-100">
                <p className="font-display text-sm font-bold text-gold-400">
                  Need help with your order?
                </p>
                <p className="mt-1 text-xs text-forest-100/80">
                  Call us or visit the store and we&apos;ll sort it out.
                </p>
                <Button href="/contact" variant="gold" size="md" className="mt-4">
                  Get Help
                  <ArrowRight size={16} weight="bold" aria-hidden="true" />
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
