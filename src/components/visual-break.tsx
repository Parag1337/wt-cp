import Image from "next/image";
import { img } from "../lib/site";
import { Button } from "./button";
import { Reveal } from "./reveal";

export function VisualBreak() {
  return (
    <section className="relative overflow-hidden">
      <Image
        src={img("green-crop-field", 1920, 1080)}
        alt="Lush green crop rows in an agricultural field"
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-forest-950/65"
      />
      <div className="container-site relative flex min-h-[400px] items-center justify-center py-20 md:min-h-[480px]">
        <Reveal className="max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Better Farming Starts With the Right Agricultural Inputs
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            Explore our products or visit our store in Khamgaon for your
            agricultural requirements.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="#contact" size="lg">
              Visit Our Store
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
