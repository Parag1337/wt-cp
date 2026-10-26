import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OrderDetailContent from "./order-detail-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id}` };
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return <OrderDetailContent orderId={Number(id)} />;
}
