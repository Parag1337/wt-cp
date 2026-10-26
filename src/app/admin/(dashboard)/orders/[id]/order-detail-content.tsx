"use client";

import { useState } from "react";
import Link from "next/link";
import {
  adminApi,
  formatDateTime,
  formatMoney,
  formatStatus,
  ORDER_FLOW,
  type AdminOrder,
} from "@/lib/admin-api";
import { paymentLabel } from "@/lib/payment";
import { useAdminQuery } from "@/components/admin/use-admin-query";
import {
  AdminCard,
  AdminErrorBanner,
  AdminSuccessBanner,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/admin-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ProductImage } from "@/components/ui/product-image";
import { ErrorState } from "@/components/ui/error-state";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  EnvelopeSimple,
  MapPin,
  Phone,
  Receipt,
  Truck,
  XCircle,
} from "@/lib/icons";

const ACTION_LABELS: Record<string, string> = {
  confirmed: "Confirm order",
  processing: "Start processing",
  packed: "Mark as packed",
  shipped: "Mark as shipped",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

/** Transitions that change what the customer expects and can't be undone. */
const CONSEQUENTIAL = new Set(["shipped", "delivered", "cancelled"]);

const NOTE_PROMPTS: Record<string, string> = {
  confirmed: "Optional note for the timeline (e.g. stock set aside).",
  shipped: "Optional note (e.g. courier name and tracking number).",
  delivered: "Optional note (e.g. handed over to the customer).",
  cancelled: "Tell the customer why this order was cancelled.",
};

function statusDescription(status: string): string {
  switch (status) {
    case "pending":
      return "The customer has placed this order and it still needs your confirmation.";
    case "confirmed":
      return "The order is accepted. Prepare the items.";
    case "processing":
      return "The order is being prepared in the store.";
    case "packed":
      return "Packed and ready for dispatch.";
    case "shipped":
      return "Out for delivery.";
    case "delivered":
      return "Handed to the customer. This can't be undone.";
    case "cancelled":
      return "This order will be cancelled for the customer and can't be reopened.";
    default:
      return "";
  }
}

function Timeline({ order }: { order: AdminOrder }) {
  type Entry = { key: string; status: string; note: string | null; at: string; by: string | null };

  const entries: Entry[] = order.history.map((entry) => ({
    key: `h-${entry.id}`,
    status: entry.status,
    note: entry.note,
    at: entry.at,
    by: entry.by,
  }));

  // Always show the creation event, even when the backend has no history row for it.
  const hasCreation = entries.some(
    (entry) =>
      entry.status.toLowerCase() === "pending" && entry.at === order.createdAt
  );
  if (!hasCreation) {
    entries.push({
      key: "created",
      status: "pending",
      note: null,
      at: order.createdAt,
      by: null,
    });
  }
  entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const currentIndex = (ORDER_FLOW as readonly string[]).indexOf(order.status.toLowerCase());

  return (
    <AdminCard className="p-5">
      <h2 className="font-display text-sm font-bold text-ink">Fulfilment timeline</h2>
      {currentIndex >= 0 && (
        <ol className="mt-3 mb-5 flex items-center gap-1" aria-label="Order progress">
          {ORDER_FLOW.map((step, index) => (
            <li key={step} className="flex-1">
              <span
                className={`block h-1.5 rounded-full ${index <= currentIndex ? "bg-leaf-500" : "bg-cream-200"}`}
                aria-hidden="true"
              />
              <span className="mt-1 hidden text-[10px] font-medium capitalize text-forest-600 sm:block">
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}
      <ol className="relative space-y-4 border-l border-forest-800/15 pl-4">
        {entries.map((entry, index) => (
          <li key={entry.key} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-white ${
                index === entries.length - 1 ? "bg-forest-700" : "bg-forest-300"
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={entry.status} />
              <span className="text-xs text-forest-600">{formatDateTime(entry.at)}</span>
            </div>
            {entry.note && <p className="mt-1 text-sm text-forest-800">{entry.note}</p>}
            {entry.by && <p className="mt-0.5 text-xs text-forest-600">by {entry.by}</p>}
          </li>
        ))}
      </ol>
      {order.history.length === 0 && (
        <p className="mt-3 text-xs text-forest-600">
          No status changes recorded yet. Changes you make here are logged in this timeline.
        </p>
      )}
    </AdminCard>
  );
}

export default function OrderDetailContent({ orderId }: { orderId: number }) {
  const query = useAdminQuery<AdminOrder>(
    async (signal) => {
      const response = await adminApi.order(orderId, signal);
      return { data: response.order };
    },
    [orderId]
  );

  const [action, setAction] = useState<{ status: string; note: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (query.status === "loading" && !query.data) {
    return (
      <div className="space-y-4">
        <TableSkeleton rows={4} />
        <TableSkeleton rows={3} />
      </div>
    );
  }

  if (query.status === "error" && !query.data) {
    if (query.error?.status === 404) {
      return (
        <>
          <Link
            href="/admin/orders"
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline"
          >
            <ArrowLeft size={16} aria-hidden="true" /> All orders
          </Link>
          <ErrorState
            title="Order not found"
            message="This order doesn't exist. It may have been removed."
          />
        </>
      );
    }
    return (
      <div>
        <Link
          href="/admin/orders"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All orders
        </Link>
        <AdminErrorBanner
          message={query.error?.message ?? "Couldn't load this order."}
          onRetry={query.reload}
          retrying={query.refreshing}
        />
      </div>
    );
  }

  const order = query.data;
  if (!order) return null;

  const transitions = order.allowedTransitions ?? [];
  const isCancelled = order.status.toLowerCase() === "cancelled";
  const primaryTransition = transitions.find((status) => status !== "cancelled");

  async function confirmAction() {
    if (!action) return;
    const response = await adminApi.updateOrderStatus(orderId, {
      status: action.status,
      note: action.note.trim() || undefined,
    });
    setAction(null);
    // Show the server's saved state immediately, then re-fetch for the timeline.
    query.setData(response.order);
    setSuccess(`Order #${orderId} is now ${formatStatus(response.order.status)}.`);
    query.reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All orders
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Order #{order.id}
            </h1>
            <p className="mt-1 text-sm text-forest-700">
              Placed {formatDateTime(order.createdAt)} · {order.itemCount}{" "}
              {order.itemCount === 1 ? "item" : "items"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-forest-600">
              Fulfilment
              <OrderStatusBadge status={order.status} />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-forest-600">
              Payment
              <PaymentStatusBadge status={order.payment.status} />
            </span>
            <button
              type="button"
              onClick={query.reload}
              disabled={query.refreshing}
              className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
            >
              {query.refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {success && <AdminSuccessBanner>{success}</AdminSuccessBanner>}
      {query.status === "error" && (
        <AdminErrorBanner
          message={`Couldn't refresh this order: ${query.error?.message ?? "unknown error"}`}
          onRetry={query.reload}
          retrying={query.refreshing}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <AdminCard className="overflow-hidden">
            <div className="border-b border-forest-800/10 px-4 py-3">
              <h2 className="font-display text-sm font-bold text-ink">Items</h2>
            </div>
            {order.items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-forest-700">This order has no recorded items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Purchased items with quantities and recorded unit prices
                  </caption>
                  <thead className="bg-cream-50 text-xs uppercase tracking-[0.08em] text-forest-600">
                    <tr>
                      <th scope="col" className="px-4 py-2 font-semibold">Product</th>
                      <th scope="col" className="px-4 py-2 text-center font-semibold">Qty</th>
                      <th scope="col" className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
                        Unit price
                      </th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.productId} className="border-t border-forest-800/8">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.productImage}
                              alt={item.productName}
                              className="size-10 shrink-0 rounded-lg"
                              sizes="40px"
                            />
                            <div>
                              <p className="font-medium text-ink">{item.productName}</p>
                              <Link
                                href={`/admin/products/${item.productId}/edit`}
                                className="text-xs text-forest-600 hover:underline"
                              >
                                Product #{item.productId}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="hidden px-4 py-3 text-right sm:table-cell">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">
                          {formatMoney(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-forest-800/10 bg-cream-50">
                      <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-forest-800">
                        Order total
                      </td>
                      <td className="px-4 py-3 text-right font-display text-base font-bold text-ink">
                        {formatMoney(order.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </AdminCard>

          <Timeline order={order} />
        </div>

        <div className="space-y-5">
          <AdminCard className="p-5">
            <h2 className="font-display text-sm font-bold text-ink">Delivery address</h2>
            <address className="mt-2 not-italic text-sm leading-relaxed text-forest-800">
              <span className="font-semibold text-ink">{order.address.fullName}</span>
              <br />
              {order.address.addressLine1}
              {order.address.addressLine2 && (
                <>
                  <br />
                  {order.address.addressLine2}
                </>
              )}
              <br />
              {order.address.city}, {order.address.state} {order.address.pincode}
            </address>
            <div className="mt-4 space-y-2 border-t border-forest-800/10 pt-3 text-sm">
              <a
                href={`tel:${order.address.phone}`}
                className="flex items-center gap-2 text-forest-700 hover:underline"
              >
                <Phone size={16} aria-hidden="true" /> {order.address.phone}
              </a>
              <a
                href={`mailto:${order.customer.email}`}
                className="flex items-center gap-2 break-all text-forest-700 hover:underline"
              >
                <EnvelopeSimple size={16} aria-hidden="true" /> {order.customer.email}
              </a>
              <p className="flex items-center gap-2 text-forest-600">
                <MapPin size={16} aria-hidden="true" /> Customer account #{order.customer.id}
              </p>
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="font-display text-sm font-bold text-ink">Payment</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-forest-600">Method</dt>
                <dd className="font-medium text-ink">{paymentLabel(order.payment.method)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-forest-600">Status</dt>
                <dd>
                  <PaymentStatusBadge status={order.payment.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-forest-600">Reference</dt>
                <dd className="break-all text-right font-medium text-ink">
                  {order.payment.ref || "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-forest-800/10 pt-2">
                <dt className="text-forest-600">Amount</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.total)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-cream-100 px-3 py-2 text-xs leading-relaxed text-forest-700">
              {order.payment.status === "paid"
                ? "Payment verified by the payment gateway."
                : order.payment.status === "cod_due"
                  ? "Cash on delivery: nothing has been collected yet. Collect the amount on delivery."
                  : order.payment.status === "pending"
                    ? "Unverified. A UPI reference is a customer claim until it is checked against the bank."
                    : "This payment was not collected."}
            </p>
          </AdminCard>

          <AdminCard className="p-5">
            <h2 className="font-display text-sm font-bold text-ink">Update fulfilment</h2>
            {isCancelled ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-forest-700">
                <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
                This order was cancelled. No further fulfilment actions are available.
              </p>
            ) : transitions.length === 0 ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-forest-700">
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-forest-600" aria-hidden="true" />
                This order is complete. No further actions are available.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-forest-600">
                  Only the next permitted steps are offered; the server rejects anything else.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {transitions.map((status) => {
                    const dangerous = status === "cancelled";
                    const isPrimary = status === primaryTransition;
                    const IconComponent =
                      status === "shipped"
                        ? Truck
                        : status === "cancelled"
                          ? XCircle
                          : status === "delivered"
                            ? CheckCircle
                            : Clock;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => {
                          setSuccess(null);
                          setAction({ status, note: "" });
                        }}
                        className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                          dangerous
                            ? "border border-red-300 bg-white text-red-700 hover:bg-red-50"
                            : isPrimary
                              ? "bg-forest-800 text-white hover:bg-forest-900"
                              : "border border-forest-800/20 bg-white text-ink hover:bg-forest-50"
                        }`}
                      >
                        <IconComponent size={16} weight="bold" aria-hidden="true" />
                        {ACTION_LABELS[status.toLowerCase()] ?? `Move to ${formatStatus(status)}`}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </AdminCard>

          <p className="flex items-start gap-2 px-1 text-xs text-forest-600">
            <Receipt size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            Every action asks for confirmation and waits for the server. If the server rejects a
            change, nothing is altered.
          </p>
        </div>
      </div>

      <ConfirmDialog
        key={action?.status ?? "closed"}
        open={action !== null}
        title={
          action
            ? `${ACTION_LABELS[action.status.toLowerCase()] ?? `Move order to ${action.status}`}?`
            : ""
        }
        description={
          action
            ? `${statusDescription(action.status)}${
                CONSEQUENTIAL.has(action.status)
                  ? " This changes what the customer sees."
                  : ""
              }`
            : undefined
        }
        confirmLabel={action ? ACTION_LABELS[action.status.toLowerCase()] ?? "Update order" : "Update"}
        tone={action?.status === "cancelled" ? "danger" : "default"}
        noteLabel="Note (optional)"
        noteValue={action?.note ?? ""}
        notePlaceholder={
          action ? NOTE_PROMPTS[action.status] ?? "Add a note for the order timeline" : undefined
        }
        onNoteChange={(note) =>
          setAction((current) => (current ? { ...current, note } : current))
        }
        onConfirm={confirmAction}
        onClose={() => setAction(null)}
      />
    </div>
  );
}
