import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CustomerLayout } from "../../components/customer-layout";
import { ShopWelcome } from "../../components/shop-welcome";
import { ShopFeatured } from "../../components/shop-featured";
import { SectionHeading } from "../../components/ui/section-heading";
import { ProductGridSkeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/button";
import { ArrowRight } from "../../lib/icons";
import { SHOP_CATEGORIES, categoryHref } from "../../lib/categories";

export const metadata: Metadata = {
  title: "Shop | Jay Hari Krushi Seva Kendra",
  description:
    "Welcome to the Jay Hari Krushi Seva Kendra online store. Browse seeds, fertilizers, pesticides and agricultural products.",
};

export default function ShopPage() {
  return (
    <CustomerLayout>
      <ShopWelcome />

      <section className="bg-white py-12 lg:py-14">
        <div className="container-site">
          <SectionHeading eyebrow="Browse by Category" title="Explore Our Products" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SHOP_CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.slug}
                  href={categoryHref(cat.slug)}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-forest-800/10 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-forest-800/25 hover:shadow-lg hover:shadow-forest-900/10"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-forest-700 transition-colors group-hover:bg-forest-800 group-hover:text-gold-400">
                    <Icon size={24} weight="fill" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-ink">
                      {cat.label}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-forest-800">
                      {cat.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-cream-50 py-12 lg:py-14">
        <div className="container-site">
          <SectionHeading
            eyebrow="Featured Products"
            title="Popular This Season"
            description="A selection of products our customers commonly look for."
          />
          <div className="mt-8">
            <Suspense fallback={<ProductGridSkeleton count={3} />}>
              <ShopFeatured limit={6} />
            </Suspense>
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop/products">
              <Button size="lg" variant="dark">
                Browse All Products
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </CustomerLayout>
  );
}
