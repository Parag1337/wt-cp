import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/admin-ui";
import OrdersContent from "./orders-content";

export const metadata: Metadata = {
  title: "Orders",
};

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} />}>
      <OrdersContent />
    </Suspense>
  );
}
