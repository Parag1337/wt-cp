import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EditProductContent from "./edit-product-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Edit product #${id}` };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  return <EditProductContent productId={Number(id)} />;
}
