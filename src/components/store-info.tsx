import { ArrowUpRight, Clock, MapPin, Phone } from "../lib/icons";
import { BUSINESS } from "../lib/site";
import { Button } from "./button";
import { Reveal } from "./reveal";

export function StoreInfo() {
  return (
    <section id="contact" className="scroll-mt-24 bg-leaf-50">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Visit Our Store
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-800">
            We would be happy to serve you at our Khamgaon location.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <Reveal>
            <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
              <h3 className="font-display text-xl font-bold text-ink">
                {BUSINESS.name}
              </h3>

              <dl className="mt-6 space-y-5">
                <div className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-leaf-100 text-forest-700">
                    <MapPin size={20} weight="fill" aria-hidden="true" />
                  </span>
                  <div>
                    <dt className="text-sm font-semibold text-ink">Address</dt>
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
                    <dt className="text-sm font-semibold text-ink">Phone</dt>
                    <dd className="mt-1">
                      <a
                        href={BUSINESS.phoneHref}
                        className="text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
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
                      Please contact us for current timings.
                    </dd>
                  </div>
                </div>
              </dl>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={BUSINESS.phoneHref}>
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
            <div className="flex h-full flex-col">
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
                {BUSINESS.name}, {BUSINESS.address.line1} {BUSINESS.address.line2}{" "}
                {BUSINESS.address.line3.replace(/,\s*$/, "")}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
