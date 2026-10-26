import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Drop, Grains, Plant, Tractor } from "../lib/icons";
import { CATEGORIES } from "../lib/site";
import { Reveal } from "./reveal";

const ICONS = [Grains, Plant, Drop, Tractor];

export function ProductCategories() {
  return (
    <section id="products" className="scroll-mt-24 bg-white">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
            Our Products
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Everything You Need for Your Farm
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-800">
            Explore our range of agricultural products and farming essentials.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-12">
          {CATEGORIES.map((category, i) => {
            const CategoryIcon = ICONS[i];
            return (
            <Reveal key={category.title} delay={i * 0.06}>
              <div className="group h-full overflow-hidden rounded-2xl border border-forest-800/10 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-forest-900/10">
              <div className="relative aspect-video overflow-hidden">
                <Image
                  src={category.image}
                  alt={category.alt}
                  fill
                  sizes="(min-width: 768px) 50vw, 90vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-6 md:p-7">
                <span className="flex size-11 items-center justify-center rounded-xl bg-leaf-100 text-forest-700">
                  <CategoryIcon size={24} weight="fill" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-ink">
                  {category.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-forest-800">
                  {category.text}
                </p>
                <Link
                  href={`/products?category=${encodeURIComponent(category.title)}`}
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
                >
                  {category.cta}
                  <ArrowRight
                    size={16}
                    weight="bold"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </div>
              </div>
            </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
