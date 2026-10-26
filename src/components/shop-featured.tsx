"use client";

import { useEffect, useState } from "react";
import { productApi, type Product } from "../lib/api";
import { ShopProductCard } from "./shop-product-card";
import { ProductGrid } from "./product-grid";
import { ProductGridSkeleton } from "./ui/skeleton";

export function ShopFeatured({ limit = 6 }: { limit?: number }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    productApi
      .list()
      .then((data) => {
        if (active) setProducts(data.products.slice(0, limit));
      })
      .catch(() => {
        if (active) setProducts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  if (loading) {
    return (
      <div role="status">
        <span className="sr-only">Loading featured products</span>
        <ProductGridSkeleton count={3} />
      </div>
    );
  }

  if (products.length === 0) return null;

  return (
    <ProductGrid
      products={products}
      renderCard={(p) => <ShopProductCard key={p.id} product={p} />}
    />
  );
}
