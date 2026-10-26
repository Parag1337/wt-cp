import type { ReactNode } from "react";
import type { Product } from "../lib/api";

export function ProductGrid({
  products,
  renderCard,
}: {
  products: Product[];
  renderCard: (product: Product) => ReactNode;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map(renderCard)}
    </div>
  );
}
