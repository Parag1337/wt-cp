import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import { Reveal } from "../../components/reveal";
import { Button } from "../../components/button";
import { PageHeader } from "../../components/ui/page-header";
import { ArrowUpRight, Clock, MapPin, Phone } from "../../lib/icons";
import { BUSINESS, STORE_HOURS } from "../../lib/site";

export const metadata: Metadata = {
  title: "Contact Us | Jay Hari Krushi Seva Kendra",
  description:
    "Get in touch with Jay Hari Krushi Seva Kendra in Khamgaon. Visit our store, call us, or send an inquiry for seeds, fertilizers, pesticides and agricultural products.",
};

export default function ContactPage() {
  return (
    <>
      <div id="page-top-sentinel" aria-hidden="true" />
      <Header />
      <main className="pt-20 lg:pt-24">
        <PageHeader
          eyebrow="Contact"
          title="Get in Touch"
          description="Visit our store in Khamgaon or reach out to us for any inquiries about our agricultural products."
        />

        <section className="bg-cream-50 pb-16 pt-6">
          <div className="container-site">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              <Reveal>
                <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
                  <h2 className="font-display text-xl font-bold text-ink">
                    {BUSINESS.name}
                  </h2>

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

                    <div className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-forest-700">
                        <Clock size={20} weight="fill" aria-hidden="true" />
                      </span>
                      <div>
                        <dt className="text-sm font-semibold text-ink">
                          Business Hours
                        </dt>
                        <dd className="mt-1 text-sm leading-relaxed text-forest-800">
                          {STORE_HOURS.weekdays}
                          <br />
                          {STORE_HOURS.sunday}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Button href={BUSINESS.phoneHref} variant="dark">
                      <Phone size={18} weight="fill" aria-hidden="true" />
                      Call Now
                    </Button>
                    <Button href={BUSINESS.mapsUrl} variant="outline">
                      Get Directions
                      <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="flex flex-col">
                  <div className="min-h-[380px] flex-1 overflow-hidden rounded-2xl border border-forest-800/15 bg-white shadow-sm">
                    <iframe
                      src={BUSINESS.mapsEmbed}
                      title="Google Maps location of Jay Hari Krushi Seva Kendra, Khamgaon"
                      className="h-full min-h-[380px] w-full border-0"
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-forest-800">
                    {BUSINESS.address.line1} {BUSINESS.address.line2}{" "}
                    {BUSINESS.address.line3.replace(/,\s*$/, "")}
                  </p>
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
