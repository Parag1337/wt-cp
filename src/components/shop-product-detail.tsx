"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle, ShoppingCart } from "@phosphor-icons/react";
import { productApi, type Product } from "../lib/api";
import { useCart } from "../lib/cart-context";
import { isPurchasable } from "../lib/product-purchase";
import { ProductImage } from "./ui/product-image";
import { ErrorState } from "./ui/error-state";
import { ProductDetailSkeleton } from "./ui/skeleton";

export function ShopProductDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { addItem, isInCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (isNaN(id)) return;
    let active = true;
    setLoading(true);
    setError(null);
    productApi
      .get(id)
      .then((data) => {
        if (active) setProduct(data.product);
      })
      .catch(() => {
        if (active) setError("We couldn't load this product right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function handleAddToCart() {
    if (!product || !isPurchasable(product)) return;
    setAdding(true);
    try {
      await addItem(product.id, quantity);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1600);
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div role="status">
        <span className="sr-only">Loading product details</span>
        <ProductDetailSkeleton />
      </div>
    );
  }

  if (error || !product) {
    return (
      <ErrorState
        title={error ? "Something went wrong" : "Product not found"}
        message={
          error
            ? "We couldn't load this product right now."
            : "This product may no longer be available."
        }
      />
    );
  }

  const inCart = added || isInCart(product.id);

  return (
    <div>
      <Link
        href="/shop/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
      >
        <span aria-hidden="true">&larr;</span>
        All Products
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductImage
            src={product.image}
            alt={product.name}
            className="aspect-[4/3] overflow-hidden rounded-2xl"
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-leaf-600">
            {product.category}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            {product.name}
          </h1>

          <div className="mt-6">
            <p className="text-2xl font-semibold text-forest-800">
              {product.price
                ? `₹${parseFloat(product.price).toLocaleString("en-IN")}`
                : "Price on request"}
            </p>
            <p
              className={`mt-1.5 inline-flex items-center gap-1.5 text-sm ${
                isPurchasable(product) ? "text-forest-600" : "text-forest-500"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isPurchasable(product) ? "bg-leaf-500" : "bg-forest-300"
                }`}
                aria-hidden="true"
              />
              {isPurchasable(product)
                ? "Available"
                : product.available
                  ? "Out of stock"
                  : "Unavailable"}
            </p>
          </div>

          <div className="mt-8 border-t border-forest-800/10 pt-7">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-forest-700">
              Description
            </h2>
            <p className="mt-3 max-w-prose text-base leading-relaxed text-forest-800">
              {product.description}
            </p>
          </div>

          {isPurchasable(product) ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-full border border-forest-800/20 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex size-11 items-center justify-center text-lg text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                  aria-label="Decrease quantity"
                >
                  &minus;
                </button>
                <span className="w-8 text-center text-base font-semibold text-ink" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  className="flex size-11 items-center justify-center text-lg text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={adding || inCart}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-all duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 sm:flex-none ${
                  inCart
                    ? "bg-leaf-100 text-forest-700"
                    : "bg-forest-800 text-white hover:bg-forest-900"
                } ${adding ? "opacity-60" : ""}`}
              >
                {inCart ? (
                  <CheckCircle size={18} weight="bold" aria-hidden="true" />
                ) : (
                  <ShoppingCart size={18} weight="bold" aria-hidden="true" />
                )}
                {adding
                  ? "Adding..."
                  : inCart
                    ? "In Cart"
                    : "Add to Cart"}
              </button>
            </div>
          ) : (
            <p
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-forest-800/5 px-5 py-3 text-sm font-semibold text-forest-700"
              role="status"
            >
              {product.available
                ? "This product is out of stock right now. Check back soon."
                : "This product is not currently available."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
