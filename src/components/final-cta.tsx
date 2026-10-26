import { ArrowUpRight, Crop, Phone } from "../lib/icons";
import { BUSINESS } from "../lib/site";
import { Button } from "./button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-forest-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-leaf-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-gold-400/10"
      />
      <Crop
        aria-hidden="true"
        size={180}
        weight="regular"
        className="pointer-events-none absolute -right-8 bottom-4 rotate-12 text-white/5"
      />

      <div className="container-site relative py-20 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Let&apos;s Grow Better Together
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/85 md:text-lg">
            Looking for agricultural products for your farm? Get in touch with
            Jay Hari Krushi Seva Kendra or visit our store in Khamgaon.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href={BUSINESS.phoneHref} size="lg">
              <Phone size={18} weight="fill" aria-hidden="true" />
              Call Now
            </Button>
            <Button href={BUSINESS.mapsUrl} variant="outline-light" size="lg">
              Get Directions
              <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
