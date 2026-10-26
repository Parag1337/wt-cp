import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/admin/admin-ui";
import InquiriesContent from "./inquiries-content";

export const metadata: Metadata = {
  title: "Inquiries",
};

export default function AdminInquiriesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={6} />}>
      <InquiriesContent />
    </Suspense>
  );
}
