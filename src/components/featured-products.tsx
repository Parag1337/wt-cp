import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "../lib/icons";
import { FEATURED_PRODUCTS } from "../lib/site";
import { Reveal } from "./reveal";

export function FeaturedProducts() {
  return (
    <section className="bg-leaf-50">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Agricultural Products You Can Find at Our Store
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-800">
            A look at the everyday products available at our store in Khamgaon.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {FEATURED_PRODUCTS.map((product, i) => (
            <Reveal key={product.title} delay={i * 0.05}>
              <div className="group h-full overflow-hidden rounded-2xl border border-forest-800/10 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-forest-900/10">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.alt}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-bold text-ink">{product.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-forest-800">
                  {product.text}
                </p>
                <Link
                  href="/products"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 transition-colors hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
                >
                  View Details
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
          ))}
        </div>
      </div>
    </section>
  );
}
