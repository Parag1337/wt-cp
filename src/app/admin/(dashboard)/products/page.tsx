import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/admin-ui";
import ProductsContent from "./products-content";

export const metadata: Metadata = {
  title: "Products",
};

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={7} />}>
      <ProductsContent />
    </Suspense>
  );
}
