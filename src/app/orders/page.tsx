import type { Metadata } from "next";
import { CustomerLayout } from "../../components/customer-layout";
import OrdersContent from "./orders-content";

export const metadata: Metadata = {
  title: "My Orders | Jay Hari Krushi Seva Kendra",
  description: "View your order history.",
};

export default function OrdersPage() {
  return (
    <CustomerLayout>
      <OrdersContent />
    </CustomerLayout>
  );
}
