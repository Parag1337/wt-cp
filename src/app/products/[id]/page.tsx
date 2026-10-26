import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "../../../components/header";
import { Footer } from "../../../components/footer";
import { ProductDetail } from "../../../components/product-detail";

type Props = {
  params: Promise<{ id: string }>;
};

async function getProduct(id: string): Promise<{ product: { id: number; name: string; category: string; description: string; image: string | null; price: string | null; available: boolean } | null } | null> {
  try {
    const res = await fetch(
      `${process.env.BACKEND_ORIGIN ?? "http://localhost:5000"}/api/products/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await getProduct(id);
  const product = data?.product;
  if (!product) {
    return { title: "Product Not Found | Jay Hari Krushi Seva Kendra" };
  }
  return {
    title: `${product.name} | Jay Hari Krushi Seva Kendra`,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const data = await getProduct(id);

  if (!data?.product) {
    notFound();
  }

  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-20 lg:pt-24">
        <section className="bg-cream-50 pb-20 pt-10 lg:pt-12">
          <div className="container-site">
            <ProductDetail />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
