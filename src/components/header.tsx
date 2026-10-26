"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, List, Phone, SignOut, ShoppingCart, User, XIcon } from "@phosphor-icons/react";
import { BUSINESS, NAV_LINKS } from "../lib/site";
import { useAuth } from "../lib/auth-context";

export function Header() {
  const router = useRouter();
  const { status, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const authenticated = status === "authenticated";

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

  const customerNavLinks = [
    { label: "Shop", href: "/shop" },
    { label: "Products", href: "/shop/products" },
    { label: "Orders", href: "/orders" },
  ];

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
          href={authenticated ? "/shop" : "/"}
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
            {authenticated
              ? customerNavLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-ink/80 transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))
              : NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-ink/80 transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {authenticated ? (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/cart"
                className="flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
              >
                <ShoppingCart size={16} weight="bold" aria-hidden="true" />
                Cart
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
              >
                <User size={16} weight="bold" aria-hidden="true" />
                Profile
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
              >
                <SignOut size={16} weight="bold" aria-hidden="true" />
                Logout
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/login"
                className="px-2 py-2 text-sm font-semibold text-ink/80 transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
              >
                Create Account
              </Link>
            </div>
          )}
          <a
            href={BUSINESS.phoneHref}
            className="hidden lg:inline-flex"
            aria-label={`Call ${BUSINESS.name} at ${BUSINESS.phone}`}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-6 py-3 text-sm font-semibold text-ink transition-all duration-200 hover:bg-gold-500 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600">
              <Phone size={18} weight="fill" aria-hidden="true" />
              Call Now
            </span>
          </a>
          <a
            href={BUSINESS.phoneHref}
            className="flex size-11 items-center justify-center rounded-full border border-forest-800/20 bg-white text-forest-800 transition-colors hover:border-forest-800/50 lg:hidden"
            aria-label={`Call ${BUSINESS.name} at ${BUSINESS.phone}`}
          >
            <Phone size={20} weight="fill" aria-hidden="true" />
          </a>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full border border-forest-800/20 bg-white text-forest-800 transition-colors hover:border-forest-800/50 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
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
          id="mobile-menu"
          className="border-t border-forest-800/10 bg-white lg:hidden"
        >
          <nav aria-label="Mobile navigation" className="container-site py-4">
            <ul className="flex flex-col">
              {authenticated
                ? customerNavLinks.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block border-b border-forest-800/5 py-3.5 text-base font-medium text-ink transition-colors hover:text-forest-700"
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))
                : NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="block border-b border-forest-800/5 py-3.5 text-base font-medium text-ink transition-colors hover:text-forest-700"
                        onClick={() => setOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
            </ul>
            <div className="mt-2 grid gap-2">
              {authenticated ? (
                <>
                  <Link
                    href="/cart"
                    className="flex items-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
                    onClick={() => setOpen(false)}
                  >
                    <ShoppingCart size={18} weight="bold" aria-hidden="true" />
                    Cart
                  </Link>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
                    onClick={() => setOpen(false)}
                  >
                    <User size={18} weight="bold" aria-hidden="true" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="flex items-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
                  >
                    <SignOut size={18} weight="bold" aria-hidden="true" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="flex items-center justify-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
                    onClick={() => setOpen(false)}
                  >
                    <User size={18} weight="bold" aria-hidden="true" />
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="flex items-center justify-center gap-2 rounded-full border border-forest-800/20 bg-white px-6 py-3.5 text-base font-semibold text-forest-800 transition-colors hover:border-forest-800/50 hover:text-forest-700"
                    onClick={() => setOpen(false)}
                  >
                    Create Account
                  </Link>
                </>
              )}
            </div>
            <a
              href={BUSINESS.phoneHref}
              className="mt-4 flex items-center justify-center gap-2 rounded-full bg-gold-400 px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-gold-500 active:scale-[0.98]"
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