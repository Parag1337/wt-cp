"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Leaf, List, Phone, SignOut, User, XIcon, ShoppingCart } from "@phosphor-icons/react";
import { BUSINESS, CUSTOMER_NAV_LINKS } from "../lib/site";
import { useAuth } from "../lib/auth-context";
import { useCart } from "../lib/cart-context";

const iconBtn =
  "flex size-11 items-center justify-center rounded-full border border-forest-800/20 bg-white text-forest-800 transition-colors hover:border-forest-800/50 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600";

export function CustomerHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, logout } = useAuth();
  const { cart } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const authenticated = status === "authenticated";
  const count = cart.totalItems;

  async function handleLogout() {
    setOpen(false);
    await logout();
    router.push("/");
  }

  useEffect(() => {
    const sentinel = document.getElementById("page-top-sentinel");
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { rootMargin: "-24px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const solid = scrolled || open;
  const isActive = (href: string) =>
    pathname === href || (href !== "/shop" && pathname.startsWith(href));

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        solid
          ? "bg-white/95 shadow-sm backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container-site flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link
          href="/shop"
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-forest-800 text-gold-400">
            <Leaf size={20} weight="fill" aria-hidden="true" />
          </span>
          <span className="truncate font-display text-sm font-bold tracking-wide text-ink sm:text-base">
            Jay Hari Krushi Seva Kendra
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden lg:block">
          <ul className="flex items-center gap-7">
            {CUSTOMER_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600 ${
                    isActive(link.href)
                      ? "text-forest-700"
                      : "text-ink/80 hover:text-forest-700"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className={`${iconBtn} relative`}
            aria-label={`Shopping cart with ${count} ${count === 1 ? "item" : "items"}`}
          >
            <ShoppingCart size={20} weight="bold" aria-hidden="true" />
            {count > 0 && (
              <span
                key={count}
                className="badge-pop absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-ink"
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className={`${iconBtn} ${isActive("/profile") ? "border-forest-800/50 bg-forest-50" : ""}`}
            aria-label="Profile"
          >
            <User size={20} weight="bold" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className={iconBtn}
            aria-label="Logout"
          >
            <SignOut size={20} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`${iconBtn} lg:hidden`}
            aria-expanded={open}
            aria-controls="customer-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <XIcon size={22} weight="bold" aria-hidden="true" />
            ) : (
              <List size={22} weight="bold" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="customer-mobile-menu"
          className="border-t border-forest-800/10 bg-white lg:hidden"
        >
          <nav aria-label="Mobile navigation" className="container-site py-4">
            <ul className="flex flex-col">
              {CUSTOMER_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`block border-b border-forest-800/5 py-3.5 text-base font-medium transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600 ${
                      isActive(link.href) ? "text-forest-700" : "text-ink"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-2">
              <Link
                href="/cart"
                className="flex items-center justify-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                onClick={() => setOpen(false)}
              >
                <ShoppingCart size={18} weight="bold" aria-hidden="true" />
                Cart {count > 0 ? `(${count})` : ""}
              </Link>
              <Link
                href="/profile"
                className="flex items-center justify-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                onClick={() => setOpen(false)}
              >
                <User size={18} weight="bold" aria-hidden="true" />
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex items-center justify-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                <SignOut size={18} weight="bold" aria-hidden="true" />
                Logout
              </button>
            </div>
            <a
              href={BUSINESS.phoneHref}
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-gold-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              onClick={() => setOpen(false)}
            >
              <Phone size={18} weight="fill" aria-hidden="true" />
              Call Now
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
