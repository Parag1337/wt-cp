import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Gallery } from "../../components/gallery";
import { PageHeader } from "../../components/ui/page-header";

export const metadata: Metadata = {
  title: "Product Gallery | Jay Hari Krushi Seva Kendra",
  description:
    "Browse our product gallery showcasing seeds, fertilizers, pesticides and agricultural products available at Jay Hari Krushi Seva Kendra in Khamgaon.",
};

export default function GalleryPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-20 lg:pt-24">
        <PageHeader
          eyebrow="Gallery"
          title="Product Gallery"
          description="Explore images of our agricultural products and store."
        />
        <Gallery />
      </main>
      <Footer />
    </>
  );
}
