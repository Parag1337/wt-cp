"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight, Eye, XIcon } from "@phosphor-icons/react";
import { GALLERY } from "../lib/site";
import { Reveal } from "./reveal";

export function Gallery() {
  const [active, setActive] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setActive(null), []);
  const prev = useCallback(
    () =>
      setActive((i) =>
        i === null ? null : (i - 1 + GALLERY.length) % GALLERY.length
      ),
    []
  );
  const next = useCallback(
    () => setActive((i) => (i === null ? null : (i + 1) % GALLERY.length)),
    []
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [active, close, prev, next]);

  const item = active === null ? null : GALLERY[active];

  return (
    <section id="gallery" className="scroll-mt-24 bg-cream-50">
      <div className="container-site py-20 lg:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
            Product Gallery
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
            Explore Our Agricultural Products
          </h2>
        </Reveal>

        <div className="mt-10 columns-2 gap-4 space-y-4 lg:columns-3">
          {GALLERY.map((g, i) => (
            <button
              key={g.title}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Open ${g.title} photo`}
              className="group relative block w-full break-inside-avoid overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              <div className={`relative w-full ${g.aspect}`}>
                <Image
                  src={g.image}
                  alt={g.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 90vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-forest-950/55 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                <Eye size={26} weight="fill" className="text-white" aria-hidden="true" />
                <span className="text-sm font-semibold text-white">
                  {g.title}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {item && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${item.title} photo viewer`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/90 p-4"
          onClick={close}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl bg-white/5">
              <Image
                src={item.lightbox}
                alt={item.alt}
                width={1200}
                height={900}
                sizes="(min-width: 768px) 60vw, 90vw"
                className="h-auto w-full object-contain"
              />
            </div>
            <p className="mt-4 text-center text-sm font-semibold text-white/90">
              {item.title}
            </p>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close photo viewer"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <XIcon size={22} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex md:left-6"
          >
            <CaretLeft size={22} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex md:right-6"
          >
            <CaretRight size={22} weight="bold" aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
