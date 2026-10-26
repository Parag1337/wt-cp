import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/admin-ui";
import InventoryContent from "./inventory-content";

export const metadata: Metadata = {
  title: "Inventory",
};

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={7} />}>
      <InventoryContent />
    </Suspense>
  );
}
