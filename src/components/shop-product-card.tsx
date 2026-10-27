"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, ShoppingCart } from "@phosphor-icons/react";
import { useCart } from "../lib/cart-context";
import { ProductImage } from "./ui/product-image";
import type { Product } from "../lib/api";

export function ShopProductCard({ product }: { product: Product }) {
  const { addItem, isInCart } = useCart();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  async function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!product.available) return;
    setAdding(true);
    setCartError(null);
    try {
      await addItem(product.id, 1);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Couldn't add to cart.");
    } finally {
      setAdding(false);
    }
  }

  const inCart = added || isInCart(product.id);
  const href = `/shop/products/${product.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-forest-800/10 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-forest-900/10">
      <Link
        href={href}
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
            href={href}
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

        <div className="mt-4 flex items-stretch gap-2.5">
          <Link
            href={href}
            className="flex flex-1 items-center justify-center rounded-full border border-forest-800/15 px-4 py-2.5 text-sm font-semibold text-forest-700 transition-colors hover:border-forest-800/40 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
          >
            View Details
          </Link>
          {product.available ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={adding || inCart}
              aria-label={`Add ${product.name} to cart`}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                inCart
                  ? "bg-leaf-100 text-forest-700"
                  : "bg-forest-800 text-white hover:bg-forest-900"
              } ${adding ? "opacity-60" : ""}`}
            >
              {inCart ? (
                <CheckCircle size={16} weight="bold" aria-hidden="true" />
              ) : (
                <ShoppingCart size={16} weight="bold" aria-hidden="true" />
              )}
              {adding ? "Adding..." : inCart ? "In Cart" : "Add to Cart"}
            </button>
          ) : (
            <span className="inline-flex flex-1 items-center justify-center rounded-full bg-cream-100 px-4 py-2.5 text-sm font-medium text-forest-500">
              Out of stock
            </span>
          )}
        </div>
        {cartError ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {cartError}
          </p>
        ) : null}
      </div>
    </article>
  );
}
