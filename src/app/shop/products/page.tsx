import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerLayout } from "../../../components/customer-layout";
import { ShopCatalog } from "../../../components/shop-catalog";
import { PageHeader } from "../../../components/ui/page-header";
import { ProductGridSkeleton } from "../../../components/ui/skeleton";

export const metadata: Metadata = {
  title: "Products | Jay Hari Krushi Seva Kendra",
  description:
    "Browse all agricultural products at Jay Hari Krushi Seva Kendra. Seeds, fertilizers, pesticides and farming inputs.",
};

export default function ShopProductsPage() {
  return (
    <CustomerLayout>
      <PageHeader
        eyebrow="Our Products"
        title="All Products"
        description="Browse our complete catalog of agricultural products."
      />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <Suspense fallback={<ProductGridSkeleton />}>
            <ShopCatalog />
          </Suspense>
        </div>
      </section>
    </CustomerLayout>
  );
}
