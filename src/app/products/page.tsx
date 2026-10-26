import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { ProductList } from "../../components/product-list";
import { PageHeader } from "../../components/ui/page-header";
import { ProductGridSkeleton } from "../../components/ui/skeleton";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Products & Services | Jay Hari Krushi Seva Kendra",
  description:
    "Browse our range of agricultural products including seeds, fertilizers, pesticides, and farming inputs at Jay Hari Krushi Seva Kendra in Khamgaon.",
};

function ProductListSkeleton() {
  return (
    <div className="py-20" role="status">
      <span className="sr-only">Loading products</span>
      <ProductGridSkeleton count={8} />
    </div>
  );
}

export default function ProductsPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-20 lg:pt-24">
        <PageHeader
          eyebrow="Our Products"
          title="Products & Services"
          description="Browse our complete catalog of agricultural products. Use the search and filters below to find exactly what you need."
        />
        <section className="bg-cream-50 pb-16 pt-6">
          <div className="container-site">
            <Suspense fallback={<ProductListSkeleton />}>
              <ProductList />
            </Suspense>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
