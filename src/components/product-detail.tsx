"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Phone } from "../lib/icons";
import { productApi, type Product } from "../lib/api";
import { BUSINESS } from "../lib/site";
import { ProductImage } from "./ui/product-image";
import { ErrorState } from "./ui/error-state";
import { ProductDetailSkeleton } from "./ui/skeleton";
import { Button } from "./button";

export function ProductDetail() {
  const params = useParams();
  const id = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    setError(null);
    productApi
      .get(id)
      .then((data) => {
        setLoading(false);
        setProduct(data.product);
      })
      .catch(() => {
        setLoading(false);
        setError("Unable to load product details. Please try again.");
      });
  }, [id]);

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
        title="Couldn't load this product"
        message={error ?? "This product could not be found."}
        onRetry={() => {
          setLoading(true);
          setError(null);
          productApi
            .get(id)
            .then((data) => {
              setLoading(false);
              setProduct(data.product);
            })
            .catch(() => {
              setLoading(false);
              setError("Unable to load product details. Please try again.");
            });
        }}
      />
    );
  }

  return (
    <div>
      <Link
        href="/products"
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

          <div className="mt-8 rounded-2xl border border-forest-800/10 bg-white p-6">
            <h3 className="font-display text-lg font-bold text-ink">
              Want to order this?
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-forest-800">
              Contact us for pricing, availability and bulk orders.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button href={BUSINESS.phoneHref}>
                <Phone size={16} weight="fill" aria-hidden="true" />
                Call Now
              </Button>
              <Button href="/contact" variant="outline">
                Send Inquiry
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
