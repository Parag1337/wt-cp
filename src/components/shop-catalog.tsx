"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { productApi, type Product } from "../lib/api";
import { SHOP_CATEGORIES } from "../lib/categories";
import { ShopProductCard } from "./shop-product-card";
import { ProductGrid } from "./product-grid";
import { EmptyState } from "./ui/empty-state";
import { ErrorState } from "./ui/error-state";
import { ProductGridSkeleton } from "./ui/skeleton";

export function ShopCatalog() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryFilter = searchParams.get("category") ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    productApi
      .list({ q: debouncedQuery, category: categoryFilter })
      .then((data) => {
        if (!active) return;
        setProducts(data.products);
      })
      .catch(() => {
        if (active) setError("We couldn't load the products right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, categoryFilter, reloadKey]);

  function selectCategory(slug: string) {
    if (!slug) {
      router.push("/shop/products");
    } else {
      router.push(`/shop/products?category=${encodeURIComponent(slug)}`);
    }
  }

  const filters = useMemo(
    () => ["", ...SHOP_CATEGORIES.map((c) => c.slug)],
    []
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <MagnifyingGlass
            size={18}
            weight="bold"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-full border border-forest-800/20 bg-white py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
          />
        </div>

        <div
          className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0"
          role="group"
          aria-label="Filter by category"
        >
          {filters.map((slug) => (
            <button
              key={slug || "all"}
              type="button"
              onClick={() => selectCategory(slug)}
              aria-pressed={categoryFilter === slug}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                categoryFilter === slug
                  ? "bg-forest-800 font-semibold text-white"
                  : "text-forest-600 hover:bg-forest-800/5 hover:text-forest-900"
              }`}
            >
              {slug === "" ? "All" : slug}
            </button>
          ))}
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div role="status" className="mt-8">
          <span className="sr-only">Loading products</span>
          <ProductGridSkeleton />
        </div>
      ) : error ? (
        <div className="mt-8">
          <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<MagnifyingGlass size={28} weight="bold" aria-hidden="true" />}
            title="No products found"
            description="Try changing your search or category filter."
          />
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid products={products} renderCard={(p) => <ShopProductCard key={p.id} product={p} />} />
        </div>
      )}
    </div>
  );
}
