"use client";

import Link from "next/link";
import { adminApi, type AdminProduct } from "@/lib/admin-api";
import { useAdminQuery } from "@/components/admin/use-admin-query";
import { AdminErrorBanner, TableSkeleton } from "@/components/admin/admin-ui";
import { ownerErrorMessage } from "@/lib/admin-form";
import { ProductForm } from "@/components/admin/product-form";
import { ErrorState } from "@/components/ui/error-state";
import { ArrowLeft } from "@/lib/icons";

export default function EditProductContent({ productId }: { productId: number }) {
  const query = useAdminQuery<AdminProduct>(
    async (signal) => {
      const response = await adminApi.product(productId, signal);
      return { data: response.product };
    },
    [productId]
  );

  if (query.status === "loading" && !query.data) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={3} />
        <TableSkeleton rows={3} />
      </div>
    );
  }

  if (query.status === "error" && !query.data) {
    if (query.error?.status === 404) {
      return (
        <ErrorState title="Product not found" message="This product doesn't exist or was removed." />
      );
    }
    return (
      <div>
        <Link href="/admin/products" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline">
          <ArrowLeft size={16} aria-hidden="true" /> All products
        </Link>
        <AdminErrorBanner
          message={ownerErrorMessage(query.error, "this product")}
          onRetry={query.reload}
          retrying={query.refreshing}
        />
      </div>
    );
  }

  if (!query.data) return null;

  return (
    <div className="space-y-4">
      {query.data.archivedAt && (
        <div className="rounded-xl border border-gold-300 bg-cream-100 px-4 py-3 text-sm text-ink">
          This product is archived and hidden from the shop. Restore it from the products list to
          sell it again.
        </div>
      )}
      {/* key forces a fresh form state when a different product is loaded */}
      <ProductForm key={query.data.id} mode="edit" product={query.data} />
    </div>
  );
}
