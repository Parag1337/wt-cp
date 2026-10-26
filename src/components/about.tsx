import Image from "next/image";
import { ArrowRight } from "../lib/icons";
import { img } from "../lib/site";
import { Button } from "./button";
import { Reveal } from "./reveal";

export function About() {
  return (
    <section id="about" className="scroll-mt-24 bg-cream-50">
      <div className="container-site grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <Reveal>
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-4 -z-10 rounded-3xl bg-leaf-100"
            />
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-lg shadow-forest-900/10">
              <Image
                src={img("farming-fields-khamgaon", 1000, 750)}
                alt="Green farming fields near Khamgaon with crops ready for harvest"
                fill
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
            About Jay Hari Krushi Seva Kendra
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Supporting Farmers, Strengthening Agriculture
          </h2>
          <div className="mt-6 space-y-4 leading-relaxed text-forest-800">
            <p>
              Jay Hari Krushi Seva Kendra is an agricultural products and
              services business based in Khamgaon, Maharashtra. We bring
              essential farming inputs together in one place, so local farmers
              and customers can find what they need close to home.
            </p>
            <p>
              From seeds and fertilizers to pesticides and other agricultural
              products, our store covers the day-to-day requirements of
              farming.
            </p>
            <p>
              We believe that a strong agricultural business is built on trust,
              accessibility and understanding the needs of local farmers.
            </p>
          </div>
          <div className="mt-8">
            <Button href="#products" variant="dark">
              Learn More
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
