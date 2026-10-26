import { WHY_ITEMS } from "../lib/site";
import { CheckCircle, MapPin, Package, Users } from "../lib/icons";
import { Reveal } from "./reveal";

const ICONS = [CheckCircle, MapPin, Package, Users];

export function WhyUs() {
  return (
    <section className="bg-white">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Why Farmers Choose Jay Hari Krushi Seva Kendra
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {WHY_ITEMS.map((item, i) => {
            const WhyIcon = ICONS[i];
            return (
            <Reveal key={item.title} delay={i * 0.05}>
              <span className="flex size-11 items-center justify-center rounded-xl bg-forest-800 text-gold-400">
                <WhyIcon size={24} weight="fill" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-forest-800">
                {item.text}
              </p>
            </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
