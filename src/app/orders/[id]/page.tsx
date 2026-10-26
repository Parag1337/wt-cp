import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CustomerLayout } from "../../../components/customer-layout";
import { ListRowsSkeleton } from "../../../components/ui/skeleton";
import OrderDetailContent from "./order-detail-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return { title: "Order Not Found | Jay Hari Krushi Seva Kendra" };
  }
  return {
    title: `Order #${id} | Jay Hari Krushi Seva Kendra`,
    description: `Order details for order #${id}`,
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    notFound();
  }

  // The order itself is loaded in the browser through the authenticated
  // /api/orders/:id proxy route. A server-side fetch here has no access to the
  // customer's auth cookie and produced a 401 -> notFound() (the "404 after
  // payment" bug).
  return (
    <CustomerLayout>
      <Suspense
        fallback={
          <div className="container-site py-10" role="status">
            <span className="sr-only">Loading your order</span>
            <ListRowsSkeleton rows={2} />
          </div>
        }
      >
        <OrderDetailContent orderId={Number(id)} />
      </Suspense>
    </CustomerLayout>
  );
}
