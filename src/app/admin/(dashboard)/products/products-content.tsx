"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_PRODUCT_CATEGORIES,
  adminApi,
  formatMoney,
  productStockState,
  type AdminProduct,
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
  SortableHeader,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import { AdminBadge, StockBadge } from "@/components/admin/admin-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ProductImage } from "@/components/ui/product-image";
import { Package, Plus } from "@/lib/icons";

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Active & archived" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Hidden from shop" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

type PendingAction = { product: AdminProduct; kind: "archive" | "restore" };

type SortKey = "name" | "category" | "price" | "stock" | "shop";

const SORT_VALUE: Record<SortKey, (product: AdminProduct) => string | number | null> = {
  name: (product) => product.name,
  category: (product) => product.category,
  price: (product) => parseMoney(product.price),
  stock: (product) => product.stockQuantity,
  shop: (product) =>
    product.archivedAt ? "archived" : product.available ? "active" : "hidden",
};

export default function ProductsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "");
  const [availability, setAvailability] = useState(() => searchParams.get("availability") ?? "");
  const [page, setPage] = useState(() => readPage(searchParams));
  const [notice, setNotice] = useState<string | null>(() => {
    const saved = searchParams.get("saved");
    const name = searchParams.get("name");
    return saved === "created" ? `${name ? `“${name}”` : "Product"} was created.` : null;
  });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);

  const debouncedQuery = useDebouncedValue(query);

  function syncUrl(next: { q: string; category: string; availability: string; page: number }) {
    const params = new URLSearchParams(
      Object.entries(buildListQuery(
        { q: next.q.trim(), category: next.category, availability: next.availability },
        next.page
      )).map(([key, value]) => [key, String(value)])
    );
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeFilters(next: Partial<{ q: string; category: string; availability: string }>) {
    const merged = { q: query, category, availability, ...next };
    if (next.q !== undefined) setQuery(next.q);
    if (next.category !== undefined) setCategory(next.category);
    if (next.availability !== undefined) setAvailability(next.availability);
    setPage(1);
    setNotice(null);
    syncUrl({ ...merged, page: 1 });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setNotice(null);
    syncUrl({ q: debouncedQuery, category, availability, page: nextPage });
  }

  const result = useAdminQuery<AdminProduct[]>(
    async (signal) => {
      const response = await adminApi.products(
        buildListQuery({ q: debouncedQuery.trim(), category, availability, pageSize: 20 }, page),
        signal
      );
      return { data: response.data, pagination: response.pagination };
    },
    [debouncedQuery, category, availability, page]
  );

  const hasFilters = Boolean(debouncedQuery.trim() || category || availability);
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
    changeFilters({ q: "", category: "", availability: "" });
  }

  async function confirmAction() {
    if (!pending) return;
    const response =
      pending.kind === "archive"
        ? await adminApi.archiveProduct(pending.product.id)
        : await adminApi.restoreProduct(pending.product.id);
    setNotice(
      `“${response.product.name}” was ${pending.kind === "archive" ? "archived and is now hidden from the shop" : "restored to the catalogue"}.`
    );
    setPending(null);
    result.reload();
  }

  const errorMessage = result.error
    ? ownerErrorMessage(result.error, result.data ? "the latest products" : "products")
    : null;

  const resultsPanel = (
    <>
      <ResultsSummary
        text={`Showing ${rows.length} of ${result.pagination?.total ?? rows.length} products on page ${
          result.pagination?.page ?? page
        }.`}
      />

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Catalogue products. Column headers sort the products on this page.
          </caption>
          <thead className="border-b border-forest-800/10 bg-cream-50 text-xs uppercase tracking-[0.08em] text-forest-600">
            <tr>
              <SortableHeader {...sortProps("name")}>Product</SortableHeader>
              <SortableHeader {...sortProps("category")}>Category</SortableHeader>
              <SortableHeader {...sortProps("price")} align="right">
                Price
              </SortableHeader>
              <SortableHeader {...sortProps("stock")}>Stock</SortableHeader>
              <SortableHeader {...sortProps("shop")}>Shop</SortableHeader>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((product) => {
              const stock = productStockState(product);
              const archived = Boolean(product.archivedAt);
              return (
                <tr
                  key={product.id}
                  className="border-b border-forest-800/8 last:border-0 hover:bg-cream-50/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        className="size-11 shrink-0 rounded-lg"
                        sizes="44px"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{product.name}</p>
                        <p className="text-xs text-forest-600">
                          #{product.id} · {product.hasOrders ? "in past orders" : "no orders yet"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-forest-800">{product.category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-ink">
                    {formatMoney(product.price, "On request")}
                  </td>
                  <td className="px-4 py-3">
                    <StockBadge state={stock} quantity={product.stockQuantity} />
                  </td>
                  <td className="px-4 py-3">
                    {archived ? (
                      <AdminBadge tone="neutral">Archived</AdminBadge>
                    ) : product.available ? (
                      <AdminBadge tone="success">Active</AdminBadge>
                    ) : (
                      <AdminBadge tone="warning">Hidden</AdminBadge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPending({ product, kind: archived ? "restore" : "archive" })}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                          archived
                            ? "border-forest-800/20 bg-white text-ink hover:bg-forest-50"
                            : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                        }`}
                      >
                        {archived ? "Restore" : "Archive"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-forest-800/8 lg:hidden">
        {rows.map((product) => {
          const stock = productStockState(product);
          const archived = Boolean(product.archivedAt);
          return (
            <li key={product.id} className="p-4">
              <div className="flex gap-3">
                <ProductImage
                  src={product.image}
                  alt={product.name}
                  className="size-14 shrink-0 rounded-lg"
                  sizes="56px"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{product.name}</p>
                  <p className="text-xs text-forest-600">
                    {product.category} · {formatMoney(product.price, "On request")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StockBadge state={stock} quantity={product.stockQuantity} />
                    {archived ? (
                      <AdminBadge tone="neutral">Archived</AdminBadge>
                    ) : product.available ? (
                      <AdminBadge tone="success">Active</AdminBadge>
                    ) : (
                      <AdminBadge tone="warning">Hidden</AdminBadge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  className="flex-1 rounded-full border border-forest-800/20 bg-white px-3 py-2 text-center text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setPending({ product, kind: archived ? "restore" : "archive" })}
                  className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
                    archived
                      ? "border-forest-800/20 bg-white text-ink hover:bg-forest-50"
                      : "border-red-200 bg-white text-red-700 hover:bg-red-50"
                  }`}
                >
                  {archived ? "Restore" : "Archive"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <PaginationBar pagination={result.pagination} onPageChange={changePage} busy={result.refreshing} />
    </>
  );

  return (
    <>
      <AdminPageHeader
        title="Products"
        description="Manage the shop catalogue, prices and availability. Archive old products instead of deleting them — order history keeps referring to them."
        actions={
          <>
            <RefreshButton onClick={result.reload} refreshing={result.refreshing} />
            <Link
              href="/admin/products/new"
              className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
            >
              <Plus size={16} weight="bold" aria-hidden="true" /> New product
            </Link>
          </>
        }
      />

      {notice && (
        <div className="mb-4">
          <AdminSuccessBanner onDismiss={() => setNotice(null)}>{notice}</AdminSuccessBanner>
        </div>
      )}

      <AdminFilterBar onClear={clearFilters} clearable={hasFilters}>
        <AdminSearchInput
          id="product-search"
          label="Search products by name or description"
          value={query}
          onChange={(value) => changeFilters({ q: value })}
          placeholder="Search products"
        />
        <AdminSelectFilter
          id="product-category"
          label="Category"
          value={category}
          onChange={(value) => changeFilters({ category: value })}
        >
          <option value="">All</option>
          {ADMIN_PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </AdminSelectFilter>
        <AdminSelectFilter
          id="product-availability"
          label="Status"
          value={availability}
          onChange={(value) => changeFilters({ availability: value })}
        >
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelectFilter>
      </AdminFilterBar>

      {errorMessage && (
        <div className="mb-4">
          <AdminErrorBanner
            message={result.data ? `Couldn't refresh products. ${errorMessage}` : errorMessage}
            onRetry={result.reload}
            retrying={result.refreshing}
          />
        </div>
      )}

      <AdminCard className="overflow-hidden">
        {result.status === "loading" && !result.data ? (
          <TableSkeleton rows={7} />
        ) : rows.length === 0 ? (
          <AdminEmptyState
            icon={<Package size={22} aria-hidden="true" />}
            title={hasFilters ? "No products match these filters" : "No products yet"}
            description={
              hasFilters
                ? "Try a different search or clear the filters."
                : "Add the first product to start selling in the shop."
            }
          >
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                <Plus size={16} weight="bold" aria-hidden="true" /> New product
              </Link>
            )}
          </AdminEmptyState>
        ) : (
          resultsPanel
        )}
      </AdminCard>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "archive" ? "Archive this product?" : "Restore this product?"}
        description={
          pending ? (
            pending.kind === "archive" ? (
              <>
                <strong>{pending.product.name}</strong> will be hidden from the shop and can no
                longer be ordered. Past orders keep their records. You can restore it at any time.
              </>
            ) : (
              <>
                <strong>{pending.product.name}</strong> will be listed in the catalogue again. It
                stays hidden from customers until you mark it available in the edit form.
              </>
            )
          ) : undefined
        }
        confirmLabel={pending?.kind === "archive" ? "Archive product" : "Restore product"}
        tone={pending?.kind === "archive" ? "danger" : "default"}
        onConfirm={confirmAction}
        onClose={() => setPending(null)}
      />
    </>
  );
}
