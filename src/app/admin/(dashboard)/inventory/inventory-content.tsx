"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  adminApi,
  AdminApiError,
  formatDateTime,
  formatMoney,
  productStockState,
  type AdminProduct,
  type StockAdjustment,
} from "@/lib/admin-api";
import {
  buildListQuery,
  ownerErrorMessage,
  readPage,
  validateStockAdjustment,
} from "@/lib/admin-form";
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
  AdminSuccessBanner,
  PaginationBar,
  RefreshButton,
  ResultsSummary,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import { StockBadge } from "@/components/admin/admin-badge";
import { ProductImage } from "@/components/ui/product-image";
import { Minus, Plus, Warehouse, X } from "@/lib/icons";

/** Screen-reader and plain-text equivalent of the badge colour. */
function stockSentence(state: "out" | "low" | "ok", quantity: number, threshold: number): string {
  if (state === "out") return "None left — restock soon.";
  if (state === "low") return `Below the alert level of ${threshold}.`;
  return `Above the alert level of ${threshold}.`;
}

const FILTERS = [
  { value: "", label: "All products" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "ok", label: "Healthy stock" },
];

export default function InventoryContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [filter, setFilter] = useState(() => searchParams.get("filter") ?? "");
  const [page, setPage] = useState(() => readPage(searchParams));
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query);


  const result = useAdminQuery<AdminProduct[]>(
    async (signal) => {
      const response = await adminApi.inventory(
        buildListQuery({ q: debouncedQuery.trim(), filter, pageSize: 20 }, page),
        signal
      );
      return { data: response.data, pagination: response.pagination };
    },
    [debouncedQuery, filter, page]
  );

  const hasFilters = Boolean(debouncedQuery.trim() || filter);

  function changeFilters(next: Partial<{ q: string; filter: string }>) {
    if (next.q !== undefined) setQuery(next.q);
    if (next.filter !== undefined) setFilter(next.filter);
    setPage(1);
    setNotice(null);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setNotice(null);
  }

  function clearFilters() {
    changeFilters({ q: "", filter: "" });
  }

  const errorMessage = result.error
    ? ownerErrorMessage(result.error, result.data ? "the latest stock levels" : "inventory")
    : null;

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Current stock for every active product. Each change is saved by the server and written to the stock adjustment log."
        actions={<RefreshButton onClick={result.reload} refreshing={result.refreshing} />}
      />

      {notice && (
        <div className="mb-4">
          <AdminSuccessBanner onDismiss={() => setNotice(null)}>{notice}</AdminSuccessBanner>
        </div>
      )}

      <AdminFilterBar onClear={clearFilters} clearable={hasFilters}>
        <AdminSearchInput
          id="inventory-search"
          label="Search inventory by product name or number"
          value={query}
          onChange={(value) => changeFilters({ q: value })}
          placeholder="Search products"
        />
        <AdminSelectFilter
          id="inventory-filter"
          label="Stock level"
          value={filter}
          onChange={(value) => changeFilters({ filter: value })}
        >
          {FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelectFilter>
      </AdminFilterBar>

      {errorMessage && (
        <div className="mb-4">
          <AdminErrorBanner
            message={result.data ? `Couldn't refresh inventory. ${errorMessage}` : errorMessage}
            onRetry={result.reload}
            retrying={result.refreshing}
          />
        </div>
      )}

      <AdminCard className="overflow-hidden">
        {result.status === "loading" && !result.data ? (
          <TableSkeleton rows={7} />
        ) : result.data && result.data.length === 0 ? (
          <AdminEmptyState
            icon={<Warehouse size={22} aria-hidden="true" />}
            title={hasFilters ? "No products match this filter" : "No products to track yet"}
            description={
              hasFilters
                ? "Try a different stock filter or search term."
                : "Products you add to the catalogue appear here with their stock levels."
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
        ) : result.data ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Product stock levels</caption>
                <thead className="border-b border-forest-800/10 bg-cream-50 text-xs uppercase tracking-[0.08em] text-forest-600">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Product</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">In stock</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Threshold</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Level</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((product) => {
                    const state = productStockState(product);
                    return (
                      <tr
                        key={product.id}
                        className={`border-b border-forest-800/8 last:border-0 hover:bg-cream-50/70 ${
                          editing?.id === product.id ? "bg-cream-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ProductImage src={product.image} alt={product.name} className="size-10 shrink-0 rounded-lg" sizes="40px" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">{product.name}</p>
                              <p className="text-xs text-forest-600">
                                {product.category} · {formatMoney(product.price, "On request")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-ink">{product.stockQuantity}</td>
                        <td className="px-4 py-3 text-right text-forest-700">{product.lowStockThreshold}</td>
                        <td className="px-4 py-3">
                          <StockBadge state={state} quantity={product.stockQuantity} />
                          <p className="mt-1 text-xs text-forest-600">
                            {stockSentence(state, product.stockQuantity, product.lowStockThreshold)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setNotice(null);
                                setEditing(editing?.id === product.id ? null : product);
                              }}
                              aria-expanded={editing?.id === product.id}
                              className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50"
                            >
                              Adjust stock
                            </button>
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-forest-800/8 lg:hidden">
              {result.data.map((product) => {
                const state = productStockState(product);
                return (
                  <li key={product.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <ProductImage src={product.image} alt={product.name} className="size-12 shrink-0 rounded-lg" sizes="48px" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{product.name}</p>
                        <p className="text-xs text-forest-600">
                          {product.stockQuantity} in stock · alert at {product.lowStockThreshold}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StockBadge state={state} quantity={product.stockQuantity} />
                          <span className="text-xs text-forest-600">
                            {stockSentence(state, product.stockQuantity, product.lowStockThreshold)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setEditing(editing?.id === product.id ? null : product);
                        }}
                        aria-expanded={editing?.id === product.id}
                        className="flex-1 rounded-full border border-forest-800/20 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-forest-50"
                      >
                        Adjust stock
                      </button>
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="flex-1 rounded-full border border-forest-800/20 bg-white px-3 py-2 text-center text-xs font-semibold text-ink hover:bg-forest-50"
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            <ResultsSummary
              text={`Showing ${result.data.length} of ${result.pagination?.total ?? result.data.length} products on page ${
                result.pagination?.page ?? page
              }.`}
            />
            <PaginationBar pagination={result.pagination} onPageChange={changePage} busy={result.refreshing} />
          </>
        ) : errorMessage ? (
          <AdminEmptyState
            title="Nothing to show right now"
            description="Fix the problem above, then try again."
          />
        ) : null}
      </AdminCard>

      {editing && (
        <StockAdjustPanel
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated, adjustment) => {
            setEditing(null);
            setNotice(
              `Stock for “${updated.name}” changed by ${adjustment.delta > 0 ? "+" : ""}${adjustment.delta} to ${updated.stockQuantity} units.`
            );
            result.reload();
          }}
        />
      )}
    </>
  );
}

function StockAdjustPanel({
  product,
  onClose,
  onSaved,
}: {
  product: AdminProduct;
  onClose: () => void;
  onSaved: (product: AdminProduct, adjustment: StockAdjustment) => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ delta?: string; reason?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const deltaRef = useRef<HTMLInputElement>(null);

  // The panel opens inside a table row, which is far down a long page: move focus
  // to the first control so keyboard users land in the form they just opened.
  useEffect(() => {
    deltaRef.current?.focus();
  }, []);

  const history = useAdminQuery<StockAdjustment[]>(
    async (signal) => {
      const response = await adminApi.stockAdjustments(product.id, { pageSize: 5 }, signal);
      return { data: response.data, pagination: response.pagination };
    },
    [product.id]
  );

  const parsedDelta = Number(delta);
  const previewQuantity =
    Number.isInteger(parsedDelta) && delta.trim() !== "" ? product.stockQuantity + parsedDelta : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setServerError(null);
    const validation = validateStockAdjustment(delta, reason);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    if (previewQuantity !== null && previewQuantity < 0) {
      setErrors({ delta: `That would make stock negative (current: ${product.stockQuantity}).` });
      return;
    }

    setSaving(true);
    try {
      const response = await adminApi.adjustStock(product.id, {
        delta: Number(delta),
        reason: reason.trim(),
      });
      onSaved(response.product, response.adjustment);
    } catch (error) {
      setServerError(
        error instanceof AdminApiError
          ? error.message
          : "The stock change wasn't saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminCard className="mt-4 p-5" >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Adjust stock · {product.name}</h2>
          <p className="mt-1 text-sm text-forest-700">
            Current stock: <strong>{product.stockQuantity}</strong> units · alert at{" "}
            {product.lowStockThreshold}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close stock adjustment" className="rounded-md p-1 text-forest-600 hover:text-ink">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stock-delta" className="text-sm font-semibold text-ink">
              Change in units
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDelta((value) => {
                    const next = (Number(value) || 0) - 1;
                    return String(next === 0 ? "" : next);
                  });
                  setErrors({});
                }}
                aria-label="Decrease by one"
                className="rounded-lg border border-forest-800/20 bg-white p-2 text-ink hover:bg-forest-50"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                ref={deltaRef}
                id="stock-delta"
                aria-label="Change in units"
                inputMode="numeric"
                value={delta}
                onChange={(event) => {
                  setDelta(event.target.value);
                  setErrors((previous) => ({ ...previous, delta: undefined }));
                }}
                placeholder="e.g. 30 or -5"
                aria-invalid={Boolean(errors.delta)}
                aria-describedby={errors.delta ? "stock-delta-error" : "stock-delta-hint"}
                className={`w-full rounded-lg border bg-white px-3 py-2 text-center text-sm font-semibold text-ink focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 ${
                  errors.delta ? "border-red-400" : "border-forest-800/20 focus:border-forest-600"
                }`}
              />
              <button
                type="button"
                onClick={() => {
                  setDelta((value) => String((Number(value) || 0) + 1));
                  setErrors({});
                }}
                aria-label="Increase by one"
                className="rounded-lg border border-forest-800/20 bg-white p-2 text-ink hover:bg-forest-50"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            {errors.delta ? (
              <p id="stock-delta-error" className="text-xs font-medium text-red-700">{errors.delta}</p>
            ) : (
              <p id="stock-delta-hint" className="text-xs text-forest-600">
                Use a positive number to add stock, a negative number to remove it.
              </p>
            )}
            <p className="text-xs text-forest-700">
              New stock after saving:{" "}
              <strong className={previewQuantity !== null && previewQuantity < 0 ? "text-red-700" : ""}>
                {previewQuantity === null ? "—" : previewQuantity}
              </strong>{" "}
              units
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="stock-reason" className="text-sm font-semibold text-ink">
              Reason
            </label>
            <input
              id="stock-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setErrors((previous) => ({ ...previous, reason: undefined }));
              }}
              maxLength={255}
              placeholder="e.g. New delivery from supplier, damaged bags"
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? "stock-reason-error" : "stock-reason-hint"}
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 ${
                errors.reason ? "border-red-400" : "border-forest-800/20 focus:border-forest-600"
              }`}
            />
            {errors.reason ? (
              <p id="stock-reason-error" className="text-xs font-medium text-red-700">{errors.reason}</p>
            ) : (
              <p id="stock-reason-hint" className="text-xs text-forest-600">
                Stored with the adjustment so every change can be traced.
              </p>
            )}
          </div>

          {serverError && <AdminErrorBanner message={serverError} />}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-forest-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-900 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save stock change"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-forest-800/20 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-forest-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-forest-800/10 bg-cream-50 p-4">
          <h3 className="text-sm font-bold text-ink">Recent adjustments</h3>
          {history.status === "loading" ? (
            <div className="mt-3 space-y-2" role="status">
              <span className="sr-only">Loading adjustment history</span>
              <div className="h-3 w-3/4 animate-pulse rounded bg-forest-800/10" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-forest-800/10" />
            </div>
          ) : history.status === "error" ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-forest-700">Couldn&apos;t load the adjustment history.</p>
              <button
                type="button"
                onClick={history.reload}
                disabled={history.refreshing}
                className="rounded-full border border-forest-800/20 bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
              >
                {history.refreshing ? "Retrying…" : "Retry"}
              </button>
            </div>
          ) : history.data && history.data.length > 0 ? (
            <ul className="mt-2 divide-y divide-forest-800/10 text-sm">
              {history.data.map((entry) => (
                <li key={entry.id} className="py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${entry.delta > 0 ? "text-forest-700" : "text-red-700"}`}>
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta}
                    </span>
                    <span className="text-xs text-forest-600">
                      {entry.previousQuantity} → {entry.newQuantity}
                    </span>
                  </div>
                  <p className="text-xs text-forest-800">{entry.reason}</p>
                  <p className="text-[11px] text-forest-500">
                    {formatDateTime(entry.createdAt)}
                    {entry.admin ? ` · ${entry.admin.fullName}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-forest-600">No stock adjustments recorded for this product yet.</p>
          )}
        </div>
      </div>
      <p className="mt-4 text-xs text-forest-600">
        Stock only changes after the server confirms it. If saving fails, the current quantity stays
        as shown above.
      </p>
    </AdminCard>
  );
}
