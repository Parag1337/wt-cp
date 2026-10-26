"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  adminApi,
  formatDate,
  formatDateTime,
  formatMoney,
  type AdminDashboard,
} from "@/lib/admin-api";
import { ownerErrorMessage } from "@/lib/admin-form";
import { useAdminQuery } from "@/components/admin/use-admin-query";
import {
  AdminCard,
  AdminEmptyState,
  AdminErrorBanner,
  AdminPageHeader,
  CardsSkeleton,
  RefreshButton,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import {
  AdminBadge,
  INQUIRY_STATUS_TONES,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/admin/admin-badge";
import {
  ArrowRight,
  ChatCircleDots,
  CheckCircle,
  Clock,
  Package,
  Receipt,
  Stack,
  Tray,
  WarningCircle,
  Warehouse,
} from "@/lib/icons";

function StatCard({
  label,
  value,
  detail,
  icon,
  href,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  href?: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneRing =
    tone === "warning"
      ? "bg-gold-300/25 text-gold-600"
      : tone === "success"
        ? "bg-leaf-100 text-forest-600"
        : "bg-cream-100 text-forest-600";

  const body = (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm transition-colors hover:border-forest-800/25">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-forest-600">{label}</p>
        <span className={`flex size-8 items-center justify-center rounded-lg ${toneRing}`}>{icon}</span>
      </div>
      <p className="font-display text-2xl font-bold leading-none text-ink">{value}</p>
      {detail && <p className="mt-auto text-xs leading-relaxed text-forest-700">{detail}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600">
      {body}
    </Link>
  ) : (
    body
  );
}

function MoneyCard({
  label,
  amount,
  orders,
  detail,
  tone,
}: {
  label: string;
  amount: string;
  orders: number;
  detail: string;
  tone: "success" | "warning" | "neutral";
}) {
  const amountClass =
    tone === "success" ? "text-forest-700" : tone === "warning" ? "text-gold-600" : "text-ink";
  return (
    <div className="rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-forest-600">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold leading-none ${amountClass}`}>
        {formatMoney(amount)}
      </p>
      <p className="mt-1 text-xs font-medium text-forest-700">
        {orders} {orders === 1 ? "order" : "orders"}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-forest-600">{detail}</p>
    </div>
  );
}

function RecentOrderRow({ order }: { order: AdminDashboard["recentOrders"][number] }) {
  return (
    <tr className="border-b border-forest-800/8 last:border-0 hover:bg-cream-50/70">
      <td className="px-4 py-3">
        <Link href={`/admin/orders/${order.id}`} className="font-semibold text-forest-700 hover:underline">
          #{order.id}
        </Link>
        <p className="text-xs text-forest-600">{formatDate(order.createdAt)}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-ink">{order.customer.fullName}</p>
        <p className="text-xs text-forest-600">{order.customer.phone}</p>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-ink">{formatMoney(order.total)}</td>
      <td className="px-4 py-3 text-center">
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="hidden px-4 py-3 text-center md:table-cell">
        <PaymentStatusBadge status={order.payment.status} />
      </td>
    </tr>
  );
}

export default function AdminOverviewPage() {
  const query = useAdminQuery<AdminDashboard>(
    async (signal) => {
      const response = await adminApi.dashboard(signal);
      return { data: response.data };
    },
    []
  );

  const dashboard = query.data;

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Live orders, collected payments, stock health and new customer inquiries."
        actions={<RefreshButton onClick={query.reload} refreshing={query.refreshing} />}
      />

      {query.status === "error" && (
        <div className="mb-6">
          <AdminErrorBanner
            message={
              dashboard
                ? `Couldn't refresh the overview. ${ownerErrorMessage(query.error, "the latest figures")}`
                : ownerErrorMessage(query.error, "the overview")
            }
            onRetry={query.reload}
            retrying={query.refreshing}
          />
        </div>
      )}

      {query.status === "loading" && !dashboard ? (
        <div className="space-y-6">
          <CardsSkeleton count={4} />
          <CardsSkeleton count={4} />
          <AdminCard>
            <TableSkeleton rows={4} />
          </AdminCard>
        </div>
      ) : dashboard ? (
        <div className="space-y-8">
          <section aria-labelledby="orders-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="orders-heading" className="font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
                Orders
              </h2>
              <Link href="/admin/orders" className="flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline">
                All orders <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total orders"
                value={dashboard.orders.total}
                detail={`${dashboard.orders.todayCount} placed today`}
                icon={<Receipt size={17} weight="bold" aria-hidden="true" />}
                href="/admin/orders"
              />
              <StatCard
                label="Awaiting action"
                value={dashboard.orders.awaitingAction}
                detail="New orders still marked pending"
                icon={<Clock size={17} weight="bold" aria-hidden="true" />}
                href="/admin/orders?status=pending"
                tone="warning"
              />
              <StatCard
                label="In progress"
                value={dashboard.orders.processing}
                detail="Confirmed, processing, packed or shipped"
                icon={<Stack size={17} weight="bold" aria-hidden="true" />}
                href="/admin/orders?status=shipped"
              />
              <StatCard
                label="Delivered"
                value={dashboard.orders.delivered}
                detail={`${dashboard.orders.cancelled} cancelled`}
                icon={<CheckCircle size={17} weight="bold" aria-hidden="true" />}
                tone="success"
              />
            </div>
          </section>

          <section aria-labelledby="money-heading">
            <h2 id="money-heading" className="mb-1 font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
              Payments
            </h2>
            <p className="mb-3 text-xs text-forest-600">
              Payments are split by what has actually been collected. Only verified online payments
              count as collected revenue.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MoneyCard
                label="Collected (verified)"
                amount={dashboard.payments.verifiedCollected}
                orders={dashboard.payments.verifiedCollectedOrders}
                detail="Paid online payments verified by the payment gateway. Excludes cancelled orders."
                tone="success"
              />
              <MoneyCard
                label="Cash on delivery due"
                amount={dashboard.payments.codDue}
                orders={dashboard.payments.codDueOrders}
                detail="To be collected when these orders are delivered. Not yet revenue."
                tone="neutral"
              />
              <MoneyCard
                label="UPI awaiting check"
                amount={dashboard.payments.upiPending}
                orders={dashboard.payments.upiPendingOrders}
                detail="Customer-submitted UPI references that still need manual verification."
                tone="warning"
              />
              <MoneyCard
                label="Failed payments"
                amount={dashboard.payments.failed}
                orders={dashboard.payments.failedOrders}
                detail="Payments that failed and were never collected."
                tone="neutral"
              />
            </div>
            <p className="mt-2 text-xs text-forest-600">
              Value of all non-cancelled orders (for context only):{" "}
              <span className="font-semibold text-forest-800">
                {formatMoney(dashboard.payments.nonCancelledOrderValue)}
              </span>
            </p>
          </section>

          <section aria-labelledby="stock-heading" className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 id="stock-heading" className="mb-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
                Stock health
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  label="Low stock"
                  value={dashboard.products.lowStock}
                  detail="Available products at or below their low-stock threshold"
                  icon={<WarningCircle size={17} weight="bold" aria-hidden="true" />}
                  href="/admin/inventory?filter=low"
                  tone="warning"
                />
                <StatCard
                  label="Out of stock"
                  value={dashboard.products.outOfStock}
                  detail={`${dashboard.products.active} active · ${dashboard.products.inactive} inactive`}
                  icon={<Warehouse size={17} weight="bold" aria-hidden="true" />}
                  href="/admin/inventory?filter=out"
                />
              </div>
            </div>
            <div>
              <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
                Inquiries
              </h2>
              <Link
                href="/admin/inquiries"
                className="flex items-center gap-4 rounded-2xl border border-forest-800/10 bg-white p-5 shadow-sm transition-colors hover:border-forest-800/25"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-forest-50 text-forest-600">
                  <ChatCircleDots size={22} weight="bold" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold leading-none text-ink">
                    {dashboard.inquiries.new}
                  </p>
                  <p className="mt-1 text-xs text-forest-700">
                    new of {dashboard.inquiries.total} total inquiries
                  </p>
                </div>
              </Link>
            </div>
          </section>

          <section aria-labelledby="recent-orders-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="recent-orders-heading" className="font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
                Recent orders
              </h2>
              <Link href="/admin/orders" className="flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <AdminCard className="overflow-hidden">
              {dashboard.recentOrders.length === 0 ? (
                <AdminEmptyState
                  icon={<Receipt size={22} aria-hidden="true" />}
                  title="No orders yet"
                  description="New customer orders will appear here as soon as they are placed."
                />
              ) : (
                <>
                  <table className="w-full text-left text-sm sm:hidden">
                    <caption className="sr-only">Five most recent orders</caption>
                    <tbody>
                      {dashboard.recentOrders.map((order) => (
                        <tr key={order.id} className="border-b border-forest-800/8 align-top last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="font-semibold text-forest-700 hover:underline"
                              >
                                #{order.id}
                              </Link>
                              <span className="font-semibold text-ink">{formatMoney(order.total)}</span>
                            </div>
                            <p className="mt-0.5 text-sm text-ink">{order.customer.fullName}</p>
                            <p className="text-xs text-forest-600">
                              {order.customer.phone} · {formatDate(order.createdAt)}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <OrderStatusBadge status={order.status} />
                              <PaymentStatusBadge status={order.payment.status} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Five most recent orders</caption>
                      <thead className="border-b border-forest-800/10 bg-cream-50 text-xs uppercase tracking-[0.08em] text-forest-600">
                        <tr>
                          <th scope="col" className="px-4 py-2.5 font-semibold">Order</th>
                          <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                          <th scope="col" className="px-4 py-2.5 text-right font-semibold">Total</th>
                          <th scope="col" className="px-4 py-2.5 text-center font-semibold">Status</th>
                          <th scope="col" className="px-4 py-2.5 text-center font-semibold">Payment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentOrders.map((order) => (
                          <RecentOrderRow key={order.id} order={order} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </AdminCard>
          </section>

          <section aria-labelledby="recent-inquiries-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="recent-inquiries-heading" className="font-display text-sm font-bold uppercase tracking-[0.1em] text-forest-700">
                Recent inquiries
              </h2>
              <Link href="/admin/inquiries" className="flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline">
                Open inbox <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <AdminCard>
              {dashboard.recentInquiries.length === 0 ? (
                <AdminEmptyState
                  icon={<Tray size={22} aria-hidden="true" />}
                  title="No inquiries yet"
                  description="Messages sent through the contact form and product pages will show up here."
                />
              ) : (
                <ul className="divide-y divide-forest-800/8">
                  {dashboard.recentInquiries.map((inquiry) => (
                    <li key={inquiry.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                          {inquiry.name}
                          <AdminBadge tone={INQUIRY_STATUS_TONES[inquiry.status] ?? "neutral"}>
                            {inquiry.status.toLowerCase()}
                          </AdminBadge>
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-forest-700">{inquiry.message}</p>
                        {inquiry.product && (
                          <p className="mt-0.5 text-xs text-forest-600">Product: {inquiry.product}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-forest-600">
                        <span>{formatDateTime(inquiry.createdAt)}</span>
                        <a href={`tel:${inquiry.phone}`} className="font-semibold text-forest-700 hover:underline">
                          Call
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </section>

          <p className="flex items-center gap-2 text-xs text-forest-600">
            <Package size={14} aria-hidden="true" />
            {dashboard.products.total} products in the catalogue · stock alerts use each
            product&apos;s own low-stock threshold.
          </p>
        </div>
      ) : null}
    </>
  );
}
