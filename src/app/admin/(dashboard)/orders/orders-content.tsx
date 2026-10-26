"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  adminApi,
  formatDateTime,
  formatMoney,
  ORDER_FLOW,
  PAYMENT_STATUSES,
  type AdminOrderSummary,
} from "@/lib/admin-api";
import {
  buildListQuery,
  nextSortDirection,
  ownerErrorMessage,
  parseMoney,
  readPage,
  sortRows,
  type SortDirection,
} from "@/lib/admin-form";
import { paymentLabel } from "@/lib/payment";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useAdminQuery } from "@/components/admin/use-admin-query";
import {
  AdminCard,
  AdminEmptyState,
  AdminErrorBanner,
  AdminFilterBar,
  AdminPageHeader,
  AdminSearchInput,
  AdminSelectFilter,
  PaginationBar,
  RefreshButton,
  ResultsSummary,
  SortableHeader,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/admin-badge";
import { Receipt } from "@/lib/icons";

type SortKey = "id" | "createdAt" | "customer" | "total" | "payment" | "status";

const SORT_VALUE: Record<SortKey, (order: AdminOrderSummary) => string | number | null> = {
  id: (order) => order.id,
  createdAt: (order) => new Date(order.createdAt).getTime(),
  customer: (order) => order.customer.fullName,
  total: (order) => parseMoney(order.total),
  payment: (order) => order.payment.status,
  status: (order) => order.status,
};

export default function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [paymentStatus, setPaymentStatus] = useState(() => searchParams.get("paymentStatus") ?? "");
  const [page, setPage] = useState(() => readPage(searchParams));
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const debouncedQuery = useDebouncedValue(query);

  /** Filters live in the URL so a refresh or a shared link keeps the same view. */
  function syncUrl(next: { q: string; status: string; paymentStatus: string; page: number }) {
    const params = new URLSearchParams(
      Object.entries(buildListQuery(
        { q: next.q.trim(), status: next.status, paymentStatus: next.paymentStatus },
        next.page
      )).map(([key, value]) => [key, String(value)])
    );
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeFilters(next: Partial<{ q: string; status: string; paymentStatus: string }>) {
    const merged = { q: query, status, paymentStatus, ...next };
    if (next.q !== undefined) setQuery(next.q);
    if (next.status !== undefined) setStatus(next.status);
    if (next.paymentStatus !== undefined) setPaymentStatus(next.paymentStatus);
    setPage(1);
    syncUrl({ ...merged, page: 1 });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    syncUrl({ q: debouncedQuery, status, paymentStatus, page: nextPage });
  }

  const result = useAdminQuery<AdminOrderSummary[]>(
    async (signal) => {
      const response = await adminApi.orders(
        buildListQuery({ q: debouncedQuery.trim(), status, paymentStatus, pageSize: 20 }, page),
        signal
      );
      return { data: response.data, pagination: response.pagination };
    },
    [debouncedQuery, status, paymentStatus, page]
  );

  const hasFilters = Boolean(debouncedQuery.trim() || status || paymentStatus);
  const rows =
    result.data && sortKey && sortDirection
      ? sortRows(result.data, SORT_VALUE[sortKey], sortDirection)
      : result.data ?? [];

  function toggleSort(key: SortKey) {
    setSortDirection(nextSortDirection(sortDirection, sortKey === key));
    setSortKey(key);
  }

  function sortProps(key: SortKey) {
    return {
      direction: sortKey === key ? sortDirection : null,
      onSort: () => toggleSort(key),
    };
  }

  function clearFilters() {
    changeFilters({ q: "", status: "", paymentStatus: "" });
  }

  const errorMessage = result.error
    ? ownerErrorMessage(result.error, result.data ? "the latest orders" : "orders")
    : null;

  const resultsPanel = (
    <>
        <ResultsSummary
          text={`Showing ${rows.length} of ${result.pagination?.total ?? rows.length} orders on page ${
            result.pagination?.page ?? page
          }.`}
        />

        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Customer orders, newest first from the server. Column headers sort the orders on
              this page.
            </caption>
            <thead className="border-b border-forest-800/10 bg-cream-50 text-xs uppercase tracking-[0.08em] text-forest-600">
              <tr>
                <SortableHeader {...sortProps("id")}>Order</SortableHeader>
                <SortableHeader {...sortProps("customer")}>Customer</SortableHeader>
                <SortableHeader {...sortProps("total")} align="right">
                  Total
                </SortableHeader>
                <SortableHeader {...sortProps("payment")}>Payment</SortableHeader>
                <SortableHeader {...sortProps("status")}>Fulfilment</SortableHeader>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-forest-800/8 last:border-0 hover:bg-cream-50/70"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-semibold text-forest-700 hover:underline"
                    >
                      #{order.id}
                    </Link>
                    <p className="text-xs text-forest-600">{formatDateTime(order.createdAt)}</p>
                    <p className="text-xs text-forest-600">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{order.customer.fullName}</p>
                    <p className="text-xs text-forest-600">{order.customer.phone}</p>
                    <p className="text-xs text-forest-600">{order.customer.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-forest-700">{paymentLabel(order.payment.method)}</p>
                    <div className="mt-1">
                      <PaymentStatusBadge status={order.payment.status} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                    <p className="mt-1 text-xs text-forest-600">
                      {order.shippingTo.city} {order.shippingTo.pincode}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-forest-800/8 lg:hidden">
          {rows.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/orders/${order.id}`} className="block px-4 py-4 hover:bg-cream-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-forest-700">#{order.id}</p>
                    <p className="text-xs text-forest-600">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <p className="font-semibold text-ink">{formatMoney(order.total)}</p>
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{order.customer.fullName}</p>
                <p className="text-xs text-forest-600">
                  {order.customer.phone} · {order.shippingTo.city} {order.shippingTo.pincode}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <OrderStatusBadge status={order.status} />
                  <PaymentStatusBadge status={order.payment.status} />
                  <span className="text-xs text-forest-600">{paymentLabel(order.payment.method)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <PaginationBar
          pagination={result.pagination}
          onPageChange={changePage}
          busy={result.refreshing}
        />
    </>
  );

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Every customer order with payment and fulfilment status. Open an order to update its progress."
        actions={<RefreshButton onClick={result.reload} refreshing={result.refreshing} />}
      />

      <AdminFilterBar onClear={clearFilters} clearable={hasFilters}>
        <AdminSearchInput
          id="order-search"
          label="Search orders by ID, customer name, phone or email"
          value={query}
          onChange={(value) => changeFilters({ q: value })}
          placeholder="Search order ID, name, phone or email"
        />
        <AdminSelectFilter
          id="order-status"
          label="Fulfilment"
          value={status}
          onChange={(value) => changeFilters({ status: value })}
        >
          <option value="">All</option>
          {ORDER_FLOW.map((value) => (
            <option key={value} value={value}>
              {value[0].toUpperCase() + value.slice(1)}
            </option>
          ))}
          <option value="cancelled">Cancelled</option>
        </AdminSelectFilter>
        <AdminSelectFilter
          id="order-payment"
          label="Payment"
          value={paymentStatus}
          onChange={(value) => changeFilters({ paymentStatus: value })}
        >
          <option value="">All</option>
          {PAYMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, " ")}
            </option>
          ))}
        </AdminSelectFilter>
      </AdminFilterBar>

      {errorMessage && (
        <div className="mb-4">
          <AdminErrorBanner
            message={
              result.data ? `Couldn't refresh orders. ${errorMessage}` : errorMessage
            }
            onRetry={result.reload}
            retrying={result.refreshing}
          />
        </div>
      )}

      <AdminCard className="overflow-hidden">
        {result.status === "loading" && !result.data ? (
          <TableSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <AdminEmptyState
            icon={<Receipt size={22} aria-hidden="true" />}
            title={hasFilters ? "No orders match these filters" : "No orders yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the status filters."
                : "Orders placed through the shop will appear here."
            }
          >
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                Clear filters
              </button>
            )}
          </AdminEmptyState>
        ) : (
          resultsPanel
        )}
      </AdminCard>

      <p className="mt-3 px-1 text-xs text-forest-600">
        Orders are listed newest first. Clicking a column heading sorts the orders currently shown
        on this page; use the search and filters to narrow the list.
      </p>
    </>
  );
}
