import { STEPS } from "../lib/site";
import { Reveal } from "./reveal";

export function HowWeHelp() {
  return (
    <section className="bg-white">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Your Farming Needs, All in One Place
          </h2>
          <p className="mt-4 text-base leading-relaxed text-forest-800">
            A simple path from requirement to product, at our Khamgaon store.
          </p>
        </Reveal>

        <div className="relative mt-12">
          <div
            aria-hidden="true"
            className="absolute bottom-10 left-7 top-0 w-px bg-forest-800/15 md:bottom-auto md:left-0 md:right-0 md:top-7 md:h-px md:w-auto"
          />
          <div className="grid gap-10 md:grid-cols-4 md:gap-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.07}>
                <div className="flex items-start gap-5 md:block">
                  <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border border-forest-800/15 bg-leaf-100 font-display text-sm font-bold text-forest-700 md:mb-5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-bold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-forest-800">
                    {step.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
