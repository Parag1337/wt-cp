import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerLayout } from "../../../../components/customer-layout";
import { ShopProductDetail } from "../../../../components/shop-product-detail";

type Props = {
  params: Promise<{ id: string }>;
};

async function getProduct(id: string) {
  try {
    const res = await fetch(
      `${process.env.BACKEND_ORIGIN ?? "http://localhost:5000"}/api/products/${id}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
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

export default async function ShopProductPage({ params }: Props) {
  const { id } = await params;
  const data = await getProduct(id);

  if (!data?.product) {
    notFound();
  }

  return (
    <CustomerLayout>
      <section className="bg-cream-50 pb-20 pt-10 lg:pt-12">
        <div className="container-site">
          <ShopProductDetail />
        </div>
      </section>
    </CustomerLayout>
  );
}
