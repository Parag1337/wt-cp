"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { orderApi, formatOrderDate, type Order } from "../../lib/order-api";
import { paymentLabel } from "../../lib/payment";
import { PageHeader } from "../../components/ui/page-header";
import { EmptyState } from "../../components/ui/empty-state";
import { ErrorState } from "../../components/ui/error-state";
import { StatusBadge } from "../../components/ui/status-badge";
import { ListRowsSkeleton } from "../../components/ui/skeleton";
import { ProductImage } from "../../components/ui/product-image";
import { Button } from "../../components/button";
import { ArrowRight, ClipboardText, Package } from "@phosphor-icons/react";

function OrderCard({ order }: { order: Order }) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold text-ink">
            Order #{order.id}
          </p>
          <p className="mt-1 text-sm text-forest-700">
            Placed on {formatOrderDate(order.createdAt)}
            {order.payment ? ` • ${paymentLabel(order.payment.method)}` : ""}
            {order.address ? ` • ${order.address.city} ${order.address.pincode}` : ""}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-5 border-t border-forest-800/10 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {order.items.slice(0, 3).map((item) => (
                <ProductImage
                  key={item.id}
                  src={item.productImage}
                  alt={item.productName}
                  className="size-10 rounded-full ring-2 ring-white"
                  imageClassName="object-cover"
                  sizes="40px"
                />
              ))}
            </div>
            <p className="text-sm text-forest-800">
              {totalItems} {totalItems === 1 ? "item" : "items"} across{" "}
              {order.items.length} {order.items.length === 1 ? "line" : "lines"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-forest-600">Total</p>
              <p className="text-base font-bold text-forest-700">
                {order.total
                  ? `₹${parseFloat(order.total).toLocaleString("en-IN")}`
                  : "Price on request"}
              </p>
            </div>
            <Link href={`/orders/${order.id}`}>
              <Button variant="dark" size="md">
                View Order
                <ArrowRight size={16} weight="bold" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    // State changes only from the request outcome so the effect doesn't
    // schedule an extra render on mount.
    orderApi
      .list()
      .then((data) => {
        if (!active) return;
        setOrders(data.orders);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function load() {
    setStatus("loading");
    setReloadKey((key) => key + 1);
  }

  if (status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading your orders</span>
        <ListRowsSkeleton rows={2} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Couldn't load your orders"
        message="We couldn't fetch your order history right now."
        onRetry={load}
      />
    );
  }

  if (orders.length === 0) {
    return (
      <>
        <PageHeader eyebrow="My Orders" title="Order History" />
        <section className="bg-cream-50 pb-16 pt-6">
          <div className="container-site">
            <EmptyState
              icon={<ClipboardText size={30} weight="fill" aria-hidden="true" />}
              title="No orders yet"
              description="Your orders will appear here after you place an order."
            >
              <Link href="/shop/products">
                <Button size="lg">
                  Start Shopping
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
        eyebrow="My Orders"
        title="Order History"
        description={`${orders.length} ${orders.length === 1 ? "order" : "orders"} placed`}
      />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <div className="space-y-5">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/shop">
              <Button variant="outline">
                <Package size={18} weight="bold" aria-hidden="true" />
                Continue Shopping
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
