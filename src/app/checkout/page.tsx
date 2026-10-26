import type { Metadata } from "next";
import { CustomerLayout } from "../../components/customer-layout";
import { PageHeader } from "../../components/ui/page-header";
import CheckoutContent from "./checkout-content";

export const metadata: Metadata = {
  title: "Checkout | Jay Hari Krushi Seva Kendra",
  description: "Enter your delivery address and place your order.",
};

export default function CheckoutPage() {
  return (
    <CustomerLayout>
      <PageHeader
        eyebrow="Checkout"
        title="Delivery & Payment"
        description="Add your address, choose a payment method, and place your order."
      />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <CheckoutContent />
        </div>
      </section>
    </CustomerLayout>
  );
}
