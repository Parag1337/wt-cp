import type { Metadata } from "next";
import { CustomerLayout } from "../../components/customer-layout";
import CartContent from "./cart-content";

export const metadata: Metadata = {
  title: "Shopping Cart | Jay Hari Krushi Seva Kendra",
  description: "View and manage your shopping cart.",
};

export default function CartPage() {
  return (
    <CustomerLayout>
      <CartContent />
    </CustomerLayout>
  );
}
