import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Reveal } from "../../components/reveal";
import { Button } from "../../components/button";
import { ArrowRight, MapPin, Phone } from "../../lib/icons";
import { BUSINESS } from "../../lib/site";
import { PageHeader } from "../../components/ui/page-header";

export const metadata: Metadata = {
  title: "About Us | Jay Hari Krushi Seva Kendra",
  description:
    "Learn about Jay Hari Krushi Seva Kendra — your trusted agricultural products store in Khamgaon, Maharashtra. Seeds, fertilizers, pesticides and more.",
};

const HIGHLIGHTS = [
  {
    title: "Trusted by Local Farmers",
    text: "We have been serving the farming community in and around Khamgaon with quality agricultural inputs.",
  },
  {
    title: "Wide Range of Products",
    text: "From seeds and fertilizers to pesticides and farming tools — everything a farmer needs under one roof.",
  },
  {
    title: "Expert Guidance",
    text: "Our team understands local farming requirements and helps you choose the right products for your crops.",
  },
  {
    title: "Convenient Location",
    text: "Located in the heart of Khamgaon at Lokhandkar Complex, near Natraj Garden, easily accessible.",
  },
];

export default function AboutPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-20 lg:pt-24">
        <PageHeader
          eyebrow="About Us"
          title="About Jay Hari Krushi Seva Kendra"
          description="Your trusted partner for agricultural products in Khamgaon, Maharashtra."
        />

        <section className="bg-cream-50">
          <div className="container-site py-16 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-2">
              <Reveal>
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                    Supporting Farmers, Strengthening Agriculture
                  </h2>
                  <div className="mt-6 space-y-4 text-base leading-relaxed text-forest-800">
                    <p>
                      Jay Hari Krushi Seva Kendra is an agricultural products
                      and services business based in Khamgaon, Maharashtra. We
                      bring essential farming inputs together in one place, so
                      local farmers and customers can find what they need
                      close to home.
                    </p>
                    <p>
                      From seeds and fertilizers to pesticides and other
                      agricultural products, our store covers the day-to-day
                      requirements of farming.
                    </p>
                    <p>
                      We believe that a strong agricultural business is built
                      on trust, accessibility and understanding the needs of
                      local farmers.
                    </p>
                  </div>
                  <div className="mt-8">
                    <Button href="/contact" variant="dark">
                      Get in Touch
                      <ArrowRight size={18} weight="bold" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {HIGHLIGHTS.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm"
                    >
                      <h3 className="font-display text-base font-bold text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-forest-800">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 lg:py-20">
          <div className="container-site">
            <Reveal className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                Visit Our Store
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              <Reveal>
                <div className="rounded-2xl border border-forest-800/10 bg-leaf-50 p-6 shadow-sm md:p-8">
                  <h3 className="font-display text-xl font-bold text-ink">
                    {BUSINESS.name}
                  </h3>
                  <dl className="mt-6 space-y-5">
                    <div className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-forest-700">
                        <MapPin size={20} weight="fill" aria-hidden="true" />
                      </span>
                      <div>
                        <dt className="text-sm font-semibold text-ink">
                          Address
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-forest-800">
                          {BUSINESS.address.line1}
                          <br />
                          {BUSINESS.address.line2}
                          <br />
                          {BUSINESS.address.line3}
                        </dd>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-forest-700">
                        <Phone size={20} weight="fill" aria-hidden="true" />
                      </span>
                      <div>
                        <dt className="text-sm font-semibold text-ink">
                          Phone
                        </dt>
                        <dd className="mt-1">
                          <a
                            href={BUSINESS.phoneHref}
                            className="text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
                          >
                            {BUSINESS.phone}
                          </a>
                        </dd>
                      </div>
                    </div>
                  </dl>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button href={BUSINESS.phoneHref} variant="dark">
                      <Phone size={18} weight="fill" aria-hidden="true" />
                      Call Now
                    </Button>
                    <Button
                      href={BUSINESS.mapsUrl}
                      variant="outline"
                    >
                      Get Directions
                      <ArrowRight size={18} weight="bold" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.1}>
                <div className="overflow-hidden rounded-2xl border border-forest-800/15 bg-white shadow-sm">
                  <iframe
                    src={BUSINESS.mapsEmbed}
                    title="Google Maps location of Jay Hari Krushi Seva Kendra, Khamgaon"
                    className="h-full min-h-[300px] w-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
