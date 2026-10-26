"use client";

import { useAuth } from "../lib/auth-context";
import { Button } from "./button";
import { ArrowRight } from "../lib/icons";

export function ShopWelcome() {
  const { customer } = useAuth();
  const firstName = customer?.fullName?.trim().split(/\s+/)[0] ?? "Farmer";

  return (
    <section className="border-b border-forest-800/5 bg-white py-10 lg:py-12">
      <div className="container-site">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-forest-700">
          Customer Portal
        </p>
        <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight tracking-tight text-ink md:text-4xl">
          Welcome back, {firstName}
        </h1>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button href="/shop/products" size="lg">
            Browse Products
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Button>
          <p className="text-sm text-forest-700">
            Find the agricultural products you need for your farm.
          </p>
        </div>
      </div>
    </section>
  );
}
