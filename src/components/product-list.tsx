"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "../lib/icons";
import { productApi, type Product } from "../lib/api";
import { PRODUCT_CATEGORIES } from "../lib/constants";
import { ProductImage } from "./ui/product-image";
import { ProductGrid } from "./product-grid";
import { EmptyState } from "./ui/empty-state";
import { ErrorState } from "./ui/error-state";
import { ProductGridSkeleton } from "./ui/skeleton";

function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-forest-800/10 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-forest-900/10">
      <Link
        href={`/products/${product.id}`}
        className="block overflow-hidden"
        aria-label={`View details for ${product.name}`}
      >
        <ProductImage
          src={product.image}
          alt={product.name}
          className="aspect-[4/3]"
          imageClassName="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf-600">
          {product.category}
        </p>
        <h3 className="mt-1.5 text-lg font-bold leading-snug text-ink">
          <Link
            href={`/products/${product.id}`}
            className="transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
          >
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 flex-1 line-clamp-2 text-sm leading-relaxed text-forest-800">
          {product.description}
        </p>

        <div className="mt-4 flex items-baseline justify-between gap-2">
          {product.price ? (
            <span className="text-base font-semibold text-forest-800">
              ₹{parseFloat(product.price).toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="text-sm font-medium text-forest-700">
              Price on request
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              product.available ? "text-forest-600" : "text-forest-500"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                product.available ? "bg-leaf-500" : "bg-forest-300"
              }`}
              aria-hidden="true"
            />
            {product.available ? "Available" : "Out of stock"}
          </span>
        </div>

        <Link
          href={`/products/${product.id}`}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-forest-800/15 px-4 py-2.5 text-sm font-semibold text-forest-700 transition-colors hover:border-forest-800/40 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
        >
          View Details
        </Link>
      </div>
    </article>
  );
}

export function ProductList() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const qParam = searchParams.get("q");

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(qParam ?? "");
  const [activeCategory, setActiveCategory] = useState(
    categoryParam ?? "all"
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await productApi.list({
          q: search || undefined,
          category: activeCategory === "all" ? undefined : activeCategory,
        });
        setProducts(data.products);
        setTotal(data.total);
      } catch {
        setError("Unable to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeCategory, search]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    productApi
      .list({
        q: search || undefined,
        category: activeCategory === "all" ? undefined : activeCategory,
      })
      .then((data) => {
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => setError("Unable to load products. Please try again."))
      .finally(() => setLoading(false));
  }

  function clearFilters() {
    setSearch("");
    setActiveCategory("all");
  }

  function retry() {
    setLoading(true);
    setError(null);
    productApi
      .list({
        q: search || undefined,
        category: activeCategory === "all" ? undefined : activeCategory,
      })
      .then((data) => {
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch(() => setError("Unable to load products. Please try again."))
      .finally(() => setLoading(false));
  }

  const hasFilter = activeCategory !== "all" || search.trim() !== "";

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full lg:max-w-sm">
          <MagnifyingGlass
            size={18}
            weight="bold"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-full border border-forest-800/20 bg-white py-2.5 pl-11 pr-4 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
          />
        </form>

        <div
          className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0"
          role="group"
          aria-label="Filter by category"
        >
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setActiveCategory(cat.slug)}
              aria-pressed={activeCategory === cat.slug}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                activeCategory === cat.slug
                  ? "bg-forest-800 font-semibold text-white"
                  : "text-forest-600 hover:bg-forest-800/5 hover:text-forest-900"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <p className="text-sm text-forest-700" role="status" aria-live="polite">
          {loading
            ? "Loading products..."
            : `${total} ${total === 1 ? "product" : "products"}${
                hasFilter ? " matching your search" : ""
              }`}
        </p>
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div role="status" className="mt-4">
          <span className="sr-only">Loading products</span>
          <ProductGridSkeleton />
        </div>
      ) : error ? (
        <div className="mt-4">
          <ErrorState
            title="Couldn't load products"
            message="We couldn't load the product catalog right now."
            onRetry={retry}
          />
        </div>
      ) : products.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<MagnifyingGlass size={28} weight="bold" aria-hidden="true" />}
            title="No products found"
            description="Try adjusting your search or filters to find what you need."
          />
        </div>
      ) : (
        <div className="mt-4">
          <ProductGrid
            products={products}
            renderCard={(p) => <ProductCard key={p.id} product={p} />}
          />
        </div>
      )}
    </div>
  );
}
