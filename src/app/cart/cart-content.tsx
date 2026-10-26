"use client";

import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import { Button } from "../../components/button";
import { PageHeader } from "../../components/ui/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { ListRowsSkeleton } from "../../components/ui/skeleton";
import { ProductImage } from "../../components/ui/product-image";
import { ArrowLeft, ArrowRight, ShoppingCart, Trash } from "@phosphor-icons/react";

const qtyBtn =
  "flex size-7 items-center justify-center rounded-full border border-forest-800/15 text-forest-700 transition-colors hover:border-forest-800/40 hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600";

export default function CartContent() {
  const { cart, removeItem, updateItem, clear, status } = useCart();

  const subtotal = cart.items.reduce((sum, item) => {
    const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
    return sum + price * item.quantity;
  }, 0);

  const priced = cart.subtotal ?? (subtotal > 0 ? String(subtotal) : null);

  if (status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading your cart</span>
        <ListRowsSkeleton rows={3} />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Your Cart" title="Shopping Cart" />
        <section className="bg-cream-50 pb-16 pt-6">
          <div className="container-site">
            <EmptyState
              icon={<ShoppingCart size={30} weight="fill" aria-hidden="true" />}
              title="Your cart is empty"
              description="Explore our agricultural products and find what you need for your farm."
            >
              <Link href="/shop/products">
                <Button size="lg">
                  Browse Products
                  <ArrowRight size={18} weight="bold" aria-hidden="true" />
                </Button>
              </Link>
            </EmptyState>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Your Cart"
        title="Shopping Cart"
        description={`${cart.totalItems} ${cart.totalItems === 1 ? "item" : "items"}`}
      />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-forest-800/10 bg-white">
              <ul className="divide-y divide-forest-800/5">
                {cart.items.map((item) => (
                  <li key={item.id} className="flex gap-4 p-4 md:p-5">
                    <Link
                      href={`/shop/products/${item.productId}`}
                      className="shrink-0"
                      aria-label={`View details for ${item.productName}`}
                    >
                      <ProductImage
                        src={item.productImage}
                        alt={item.productName}
                        className="size-16 rounded-lg md:size-20"
                        imageClassName="object-cover"
                        sizes="80px"
                      />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/shop/products/${item.productId}`}
                            className="block truncate text-base font-semibold text-ink transition-colors hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                          >
                            {item.productName}
                          </Link>
                          <p className="mt-0.5 text-xs text-forest-600">
                            {item.productCategory}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="shrink-0 rounded-full p-1.5 text-forest-400 transition-colors hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                          aria-label={`Remove ${item.productName} from cart`}
                        >
                          <Trash size={16} weight="bold" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.id, Math.max(1, item.quantity - 1))
                            }
                            className={qtyBtn}
                            aria-label={`Decrease quantity of ${item.productName}`}
                          >
                            &minus;
                          </button>
                          <span
                            className="w-6 text-center text-sm font-semibold text-ink"
                            aria-live="polite"
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(item.id, Math.min(99, item.quantity + 1))
                            }
                            className={qtyBtn}
                            aria-label={`Increase quantity of ${item.productName}`}
                          >
                            +
                          </button>
                        </div>
                        {item.unitPrice ? (
                          <span className="text-sm font-semibold text-forest-800">
                            ₹
                            {(
                              parseFloat(item.unitPrice) * item.quantity
                            ).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-sm text-forest-600">
                            Price on request
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t border-forest-800/5 p-4 md:p-5">
                <button
                  type="button"
                  onClick={clear}
                  className="text-sm font-semibold text-red-700 underline-offset-4 transition-colors hover:text-red-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600"
                >
                  Clear Cart
                </button>
              </div>
            </div>

            <div className="lg:self-start">
              <div className="rounded-2xl border border-forest-800/10 bg-white p-6">
                <h2 className="font-display text-lg font-bold text-ink">
                  Order Summary
                </h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-forest-700">Items</dt>
                    <dd className="font-semibold text-ink">{cart.totalItems}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-forest-700">Subtotal</dt>
                    <dd className="font-semibold text-ink">
                      {priced
                        ? `₹${parseFloat(priced).toLocaleString("en-IN")}`
                        : "Price on request"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 border-t border-forest-800/10 pt-4">
                  <div className="flex justify-between text-base">
                    <dt className="font-semibold text-ink">Total</dt>
                    <dd className="font-bold text-forest-800">
                      {priced
                        ? `₹${parseFloat(priced).toLocaleString("en-IN")}`
                        : "Price on request"}
                    </dd>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <Button href="/checkout" className="w-full">
                    Proceed to Checkout
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </Button>
                  <Link
                    href="/shop/products"
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
                  >
                    <ArrowLeft size={16} weight="bold" aria-hidden="true" />
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
