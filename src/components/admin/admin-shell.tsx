"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "./admin-auth-provider";
import {
  ChatCircleDots,
  Gauge,
  Leaf,
  List,
  Package,
  Receipt,
  SignOut,
  Storefront,
  User,
  Warehouse,
  X,
  type Icon,
} from "../../lib/icons";

const NAV: { href: string; label: string; icon: Icon; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/inquiries", label: "Inquiries", icon: ChatCircleDots },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isActive(pathname: string, item: (typeof NAV)[number]): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Top-bar account menu: identity, storefront link and sign out. */
function AccountMenu({ name, email, onSignOut }: { name: string; email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative ml-auto">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-forest-800/15 bg-white py-1 pl-1 pr-2.5 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-forest-800 text-[11px] font-bold text-leaf-100">
          {initials(name) || "A"}
        </span>
        <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
        <span aria-hidden="true" className="text-[10px] text-forest-600">
          {open ? "▲" : "▼"}
        </span>
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-forest-800/10 bg-white shadow-lg"
        >
          <div className="border-b border-forest-800/10 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-forest-600">{email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-cream-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600"
          >
            <User size={16} aria-hidden="true" /> My account
          </Link>
          <Link
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-ink hover:bg-cream-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600"
          >
            <Storefront size={16} aria-hidden="true" /> View storefront
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 border-t border-forest-800/10 px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-forest-600"
          >
            <SignOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, signOut } = useAdminAuth();
  const current = NAV.find((item) => isActive(pathname, item));

  // Close the mobile drawer on navigation without an effect: store the path the
  // drawer was opened on and derive its open state from that.
  const [openedOnPath, setOpenedOnPath] = useState<string | null>(null);
  const drawerOpen = openedOnPath === pathname;

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenedOnPath(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const sidebar = (
    <div className="flex h-full flex-col bg-forest-900 text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-leaf-500/20 text-leaf-300">
          <Leaf size={20} weight="fill" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold leading-tight">Jay Hari Krushi</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-200/80">
            Owner dashboard
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenedOnPath(null)}
          className="ml-auto rounded-md p-1 text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-300 lg:hidden"
          aria-label="Close navigation"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Owner dashboard" className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-300 ${
                active
                  ? "bg-white/10 text-white"
                  : "text-leaf-100/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <IconComponent size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-leaf-100/80 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-300"
        >
          <Storefront size={18} aria-hidden="true" />
          View storefront
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-leaf-500 text-xs font-bold leading-none text-white">
            {initials(admin.fullName) || "A"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{admin.fullName}</p>
            <p className="truncate text-xs text-leaf-100/70">{admin.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md p-1.5 text-leaf-100/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf-300"
            aria-label="Sign out of the owner dashboard"
            title="Sign out"
          >
            <SignOut size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream-50">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="absolute inset-0 bg-forest-950/50"
            onClick={() => setOpenedOnPath(null)}
          />
          <aside className="relative h-full w-72 max-w-[85vw] shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-forest-800/10 bg-cream-50/95 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setOpenedOnPath(pathname)}
            className="inline-flex items-center gap-2 rounded-lg border border-forest-800/15 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <List size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          <p className="text-sm font-semibold text-forest-800">{current?.label ?? "Dashboard"}</p>
          <AccountMenu name={admin.fullName} email={admin.email} onSignOut={signOut} />
        </header>

        <main id="admin-main" className="px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
