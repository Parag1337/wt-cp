import Link from "next/link";
import { Leaf, MapPin, Phone } from "../lib/icons";
import { BUSINESS, NAV_LINKS } from "../lib/site";

const PRODUCT_LINKS = [
  { label: "Seeds", href: "/products?category=Seeds" },
  { label: "Fertilizers", href: "/products?category=Fertilizers" },
  { label: "Pesticides", href: "/products?category=Pesticides" },
  { label: "Agricultural Products", href: "/products?category=Agricultural%20Products" },
];

export function Footer() {
  return (
    <footer className="bg-forest-950">
      <div className="container-site pb-8 pt-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-leaf-500/15 text-leaf-200">
                <Leaf size={20} weight="fill" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-bold tracking-wide text-white">
                Jay Hari Krushi Seva Kendra
              </span>
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Agricultural products for your farming needs.
            </p>
          </div>

          <nav aria-label="Footer quick links">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Quick Links
            </h3>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Footer product links">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Products
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              Contact
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <MapPin
                  size={16}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-leaf-300"
                  aria-hidden="true"
                />
                <span>{BUSINESS.city}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone
                  size={16}
                  weight="fill"
                  className="shrink-0 text-leaf-300"
                  aria-hidden="true"
                />
                <a
                  href={BUSINESS.phoneHref}
                  className="transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf-200"
                >
                  {BUSINESS.phone}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-xs text-white/60">
            &copy; 2026 Jay Hari Krushi Seva Kendra. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}