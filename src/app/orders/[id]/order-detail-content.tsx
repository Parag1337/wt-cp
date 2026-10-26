"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  orderApi,
  OrderApiError,
  formatOrderDate,
  type Order,
} from "../../../lib/order-api";
import {
  canRetryPayment,
  getCheckoutFlag,
  getOrderFeedback,
  paymentStatusLabel,
  type FeedbackTone,
} from "../../../lib/order-feedback";
import { paymentLabel } from "../../../lib/payment";
import { openRazorpayCheckout } from "../../../lib/razorpay-checkout";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { ProductImage } from "../../../components/ui/product-image";
import { EmptyState } from "../../../components/ui/empty-state";
import { ErrorState } from "../../../components/ui/error-state";
import { ListRowsSkeleton } from "../../../components/ui/skeleton";
import { Button } from "../../../components/button";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  LockKey,
  Package,
  WarningCircle,
} from "../../../lib/icons";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; order: Order }
  | { status: "error"; kind: "unauthorized" | "not-found" | "network"; message: string };

const TONE_STYLES: Record<FeedbackTone, string> = {
  success: "border-leaf-300 bg-leaf-50 text-forest-900",
  info: "border-forest-800/10 bg-white text-forest-900",
  warning: "border-gold-300 bg-cream-100 text-ink",
  error: "border-red-200 bg-red-50 text-red-800",
};

function FeedbackIcon({ tone }: { tone: FeedbackTone }) {
  if (tone === "success") {
    return <CheckCircle size={22} weight="fill" aria-hidden="true" />;
  }
  if (tone === "warning" || tone === "error") {
    return <WarningCircle size={22} weight="fill" aria-hidden="true" />;
  }
  return <Clock size={22} weight="bold" aria-hidden="true" />;
}

function money(value: string | null, fallback = "Price on request"): string {
  if (!value) return fallback;
  return `₹${parseFloat(value).toLocaleString("en-IN")}`;
}

export default function OrderDetailContent({ orderId }: { orderId: number }) {
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [paying, setPaying] = useState(false);
  const [payState, setPayState] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;

    // No synchronous setState here: state only changes from the request outcome,
    // which keeps React from cascading renders on every navigation.
    orderApi
      .get(orderId)
      .then((data) => {
        if (active) setState({ status: "ready", order: data.order });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof OrderApiError && error.status === 401) {
          setState({
            status: "error",
            kind: "unauthorized",
            message: error.message,
          });
          return;
        }
        if (error instanceof OrderApiError && error.status === 404) {
          setState({
            status: "error",
            kind: "not-found",
            message: "This order doesn't exist or doesn't belong to your account.",
          });
          return;
        }
        setState({
          status: "error",
          kind: "network",
          message:
            error instanceof Error
              ? error.message
              : "We couldn't load this order right now.",
        });
      });

    return () => {
      active = false;
    };
  }, [orderId, reloadKey]);

  const flag = useMemo(() => getCheckoutFlag(searchParams), [searchParams]);

  async function handlePayNow() {
    if (paying || state.status !== "ready") return;
    const order = state.order;

    setPaying(true);
    setPayState(null);

    try {
      const data = await orderApi.retryPayment(orderId);

      const result = await openRazorpayCheckout({
        keyId: data.razorpay.keyId,
        orderId: data.razorpay.orderId,
        amountPaise: data.razorpay.amountPaise,
        orderNumber: order.id,
        customerName: order.address?.fullName,
        customerPhone: order.address?.phone,
      });

      if (result.status === "unavailable") {
        setPayState({
          tone: "error",
          message:
            "The payment window couldn't be loaded. Check your connection or ad blocker, then try again.",
        });
        return;
      }

      if (result.status === "dismissed") {
        setPayState({
          tone: "info",
          message: "Payment window closed. Nothing was charged.",
        });
        return;
      }

      if (result.status === "failed") {
        setPayState({ tone: "error", message: result.reason });
        return;
      }

      try {
        await orderApi.verifyPayment(order.id, {
          razorpayPaymentId: result.paymentId,
          razorpaySignature: result.signature,
        });
        setPayState({ tone: "info", message: "Payment confirmed." });
      } catch (error) {
        setPayState({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "We couldn't confirm your payment yet. Refresh this order in a moment.",
        });
      }
    } catch (error) {
      setPayState({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't start the payment. Please try again.",
      });
    } finally {
      setPaying(false);
      // Always re-read authoritative state after a payment attempt.
      setReloadKey((key) => key + 1);
    }
  }

  if (state.status === "loading") {
    return (
      <div className="container-site py-10" role="status">
        <span className="sr-only">Loading your order</span>
        <ListRowsSkeleton rows={2} />
      </div>
    );
  }

  if (state.status === "error") {
    const loginHref = `/login?redirect=${encodeURIComponent(`/orders/${orderId}`)}`;
    return (
      <div className="container-site py-12">
        {state.kind === "unauthorized" ? (
          <EmptyState
            icon={<LockKey size={30} weight="bold" aria-hidden="true" />}
            title="Please log in to view this order"
            description="Your session may have expired. Log in again and we'll bring you back to this order."
          >
            <Link href={loginHref}>
              <Button size="lg">
                Log In
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Button>
            </Link>
          </EmptyState>
        ) : state.kind === "not-found" ? (
          <EmptyState
            icon={<Package size={30} weight="fill" aria-hidden="true" />}
            title="Order not found"
            description={state.message}
          >
            <Link href="/orders">
              <Button size="lg">Back to Orders</Button>
            </Link>
          </EmptyState>
        ) : (
          <ErrorState
            title="Couldn't load this order"
            message={state.message}
            onRetry={() => setReloadKey((key) => key + 1)}
          />
        )}
      </div>
    );
  }

  const order = state.order;
  const feedback = getOrderFeedback(order, flag);
  const retryAvailable = canRetryPayment(order);
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <PageHeader
        eyebrow="Order Details"
        title={`Order #${order.id}`}
        description={`Placed on ${formatOrderDate(order.createdAt)} • ${totalItems} ${
          totalItems === 1 ? "item" : "items"
        }`}
      />
      <section className="bg-cream-50 pb-16 pt-6">
        <div className="container-site">
          <Link
            href="/orders"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest-600"
          >
            <ArrowLeft size={18} weight="bold" aria-hidden="true" />
            Back to Orders
          </Link>

          <div className="mx-auto max-w-3xl space-y-5">
            {feedback && (
              <div
                role="status"
                className={`flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-start sm:justify-between ${TONE_STYLES[feedback.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">
                    <FeedbackIcon tone={feedback.tone} />
                  </span>
                  <div>
                    <p className="font-display text-base font-bold">{feedback.title}</p>
                    <p className="mt-1 text-sm leading-relaxed">{feedback.message}</p>
                  </div>
                </div>
                {feedback.canRetryPayment && retryAvailable && (
                  <Button
                    type="button"
                    size="md"
                    className="shrink-0"
                    disabled={paying}
                    onClick={() => void handlePayNow()}
                  >
                    {paying
                      ? "Opening payment..."
                      : order.total
                        ? `Pay ${money(order.total)} now`
                        : "Pay now"}
                  </Button>
                )}
              </div>
            )}

            {payState && (
              <p
                role={payState.tone === "error" ? "alert" : "status"}
                className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                  payState.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-forest-800/10 bg-white text-forest-800"
                }`}
              >
                <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{payState.message}</span>
              </p>
            )}

            <div className="rounded-2xl border border-forest-800/10 bg-white p-6 shadow-sm md:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-ink">Order Summary</h2>
                <StatusBadge status={order.status} />
              </div>

              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold text-forest-800">Order ID</dt>
                  <dd className="mt-1 text-base text-ink">#{order.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-forest-800">Placed On</dt>
                  <dd className="mt-1 text-base text-ink">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-forest-800">Status</dt>
                  <dd className="mt-1 text-base capitalize text-ink">{order.status}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-forest-800">Total</dt>
                  <dd className="mt-1 text-base font-bold text-forest-700">
                    {money(order.total)}
                  </dd>
                </div>
              </dl>

              <div className="mt-8 border-t border-forest-800/10 pt-6">
                <h3 className="font-display text-base font-bold text-ink">
                  Delivery &amp; Payment
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-semibold text-forest-800">Deliver to</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {order.address ? (
                        <>
                          {order.address.fullName}, {order.address.phone}
                          <br />
                          {order.address.addressLine1}
                          {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""}
                          <br />
                          {order.address.city}, {order.address.state} {order.address.pincode}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold text-forest-800">Payment</dt>
                    <dd className="mt-1 text-sm text-ink">
                      {order.payment ? (
                        <>
                          {paymentLabel(order.payment.method)} •{" "}
                          {paymentStatusLabel(order.payment.status)}
                          {order.payment.ref ? (
                            <>
                              <br />
                              Ref: {order.payment.ref}
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                </dl>

                {order.payment?.method === "cod" && order.payment.status !== "paid" && (
                  <p className="mt-4 rounded-xl bg-cream-50 p-4 text-sm leading-relaxed text-forest-800">
                    Cash on Delivery: nothing has been paid yet. Please keep{" "}
                    {money(order.total)} ready in cash or UPI when the order is
                    delivered. This order is not recorded as collected revenue.
                  </p>
                )}
                {order.payment?.method === "upi" && order.payment.status !== "paid" && (
                  <p className="mt-4 rounded-xl bg-cream-50 p-4 text-sm leading-relaxed text-forest-800">
                    UPI: your transaction reference has been saved but is not proof
                    of payment. The store will verify it before dispatch and confirm
                    this order.
                  </p>
                )}
                {retryAvailable && (
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => void handlePayNow()} disabled={paying}>
                      {paying ? "Opening payment..." : "Pay now"}
                    </Button>
                    <span className="text-sm text-forest-700">
                      Your order stays pending until the payment is verified.
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-8 border-t border-forest-800/10 pt-6">
                <h3 className="font-display text-base font-bold text-ink">
                  Items ({totalItems})
                </h3>
                <div className="mt-4 space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-xl border border-forest-800/5 bg-cream-50 p-3"
                    >
                      <ProductImage
                        src={item.productImage}
                        alt={item.productName}
                        className="size-12 shrink-0 rounded-lg"
                        imageClassName="object-cover"
                        sizes="48px"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {item.productName}
                        </p>
                        <p className="text-xs text-forest-600">
                          Qty: {item.quantity} × ₹
                          {parseFloat(item.unitPrice).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-forest-700">
                        ₹{parseFloat(item.subtotal).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/shop/products"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
              >
                <ArrowLeft size={16} weight="bold" aria-hidden="true" />
                Continue Shopping
              </Link>
              <Link
                href="/contact"
                className="text-sm font-semibold text-forest-700 underline-offset-4 transition-colors hover:text-forest-900 hover:underline"
              >
                Need help with this order?
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
