import { TRUST_ITEMS } from "../lib/site";
import { Flask, Leaf, MapPin, Users } from "../lib/icons";
import { Reveal } from "./reveal";

const ICONS = [Leaf, Flask, Users, MapPin];

export function TrustStrip() {
  return (
    <section aria-label="Why visit us" className="bg-white">
      <div className="container-site py-14">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_ITEMS.map((item, i) => {
            const TrustIcon = ICONS[i];
            return (
            <Reveal key={item.title} delay={i * 0.05}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-forest-800/10 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-forest-800/25 md:p-6">
                <span className="flex size-10 items-center justify-center rounded-full bg-leaf-100 text-forest-700">
                  <TrustIcon size={22} weight="fill" aria-hidden="true" />
                </span>
                <h3 className="text-base font-bold text-ink">{item.title}</h3>
                <p className="text-sm leading-relaxed text-forest-800">
                  {item.text}
                </p>
              </div>
            </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
