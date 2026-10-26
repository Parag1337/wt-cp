import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { TrustStrip } from "../components/trust-strip";
import { About } from "../components/about";
import { ProductCategories } from "../components/product-categories";
import { FeaturedProducts } from "../components/featured-products";
import { WhyUs } from "../components/why-us";
import { VisualBreak } from "../components/visual-break";
import { Gallery } from "../components/gallery";
import { HowWeHelp } from "../components/how-we-help";
import { StoreInfo } from "../components/store-info";
import { InquiryForm } from "../components/inquiry-form";
import { FinalCta } from "../components/final-cta";
import { Footer } from "../components/footer";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <About />
        <ProductCategories />
        <FeaturedProducts />
        <WhyUs />
        <VisualBreak />
        <Gallery />
        <HowWeHelp />
        <StoreInfo />
        <InquiryForm />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}