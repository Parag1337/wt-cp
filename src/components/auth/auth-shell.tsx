import type { ReactNode } from "react";
import { Leaf } from "../../lib/icons";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-cream-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-leaf-100/80 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-gold-300/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[8%] top-16 rotate-12 text-forest-800/[0.06]"
      >
        <Leaf size={160} weight="fill" />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 right-[6%] -rotate-12 text-forest-800/[0.06]"
      >
        <Leaf size={120} weight="fill" />
      </div>

      <div className="container-site relative py-14 md:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-[440px]">{children}</div>
      </div>
    </section>
  );
}