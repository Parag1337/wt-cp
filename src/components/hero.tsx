import Image from "next/image";
import { ArrowRight, Leaf, MapPin, Phone } from "../lib/icons";
import { BUSINESS, img } from "../lib/site";
import { Button } from "./button";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section
      id="home"
      className="relative overflow-hidden bg-gradient-to-b from-cream-50 to-white"
    >
      <div
        id="page-top-sentinel"
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-px w-px"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-16 size-[26rem] rounded-full bg-leaf-100 opacity-70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 bottom-0 size-72 rounded-full bg-gold-300/25 blur-3xl"
      />

      <div className="container-site relative grid items-center gap-12 pb-16 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24 lg:pt-24">
        <Reveal>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
            <span className="inline-flex items-center gap-2">
              <Leaf size={16} weight="fill" className="text-leaf-500" aria-hidden="true" />
              Your Local Agricultural Partner
            </span>
            <span aria-hidden="true" className="h-px w-6 bg-forest-800/25" />
            <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
              <MapPin size={15} weight="fill" className="text-leaf-500" aria-hidden="true" />
              Khamgaon, Maharashtra
            </span>
          </p>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink md:text-5xl xl:text-6xl">
            Quality Agricultural Products for{" "}
            <span className="text-gold-600">Better Farming</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-forest-800 md:text-lg">
            Seeds, fertilizers, pesticides and essential agricultural products
            for your farming needs, serving farmers and customers in Khamgaon,
            Maharashtra.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button href="#products" size="lg">
              Explore Products
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Button>
            <Button href={BUSINESS.phoneHref} variant="outline" size="lg">
              <Phone size={18} weight="fill" aria-hidden="true" />
              Call Now
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
            <div
              aria-hidden="true"
              className="absolute -inset-4 -rotate-2 rounded-[2.5rem] bg-leaf-100"
            />
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl shadow-xl shadow-forest-900/15">
              <Image
                src={img("khamgaon-green-fields", 1000, 1250)}
                alt="Indian farmer standing in a green crop field near Khamgaon"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
