/**
 * Small pure helpers shared by admin screens (unit-testable without a DOM).
 */
import type { AdminProduct } from "./admin-api";

export type AdminFilters = {
  q: string;
  status: string;
  paymentStatus: string;
  page: number;
};

/** Reads the filters a screen supports from a URLSearchParams (deep links like /admin/orders?status=pending). */
export function readFilters(
  params: { get(key: string): string | null },
  keys: readonly string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    out[key] = params.get(key) ?? "";
  }
  return out;
}

export function readPage(params: { get(key: string): string | null }): number {
  const raw = Number(params.get("page"));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

/** Builds the query string for list endpoints, dropping empty values and the default page. */
export function buildListQuery(
  filters: Record<string, string | number | undefined>,
  page: number
): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) query[key] = value;
  }
  if (page > 1) query.page = page;
  return query;
}

export type ProductFormValues = {
  name: string;
  category: string;
  description: string;
  price: string;
  available: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | "image", string>>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  category: "Seeds",
  description: "",
  price: "",
  available: true,
  stockQuantity: "0",
  lowStockThreshold: "5",
};

export function productToForm(product: AdminProduct): ProductFormValues {
  return {
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price ?? "",
    available: product.available,
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
  };
}

const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export function validateProductForm(
  values: ProductFormValues,
  categories: readonly string[]
): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const name = values.name.trim();
  const description = values.description.trim();

  if (name.length < 2) errors.name = "Enter a product name (at least 2 characters).";
  else if (name.length > 200) errors.name = "Keep the name under 200 characters.";

  if (!categories.includes(values.category)) errors.category = "Choose a valid category.";

  if (description.length < 1) errors.description = "Add a short description for customers.";
  else if (description.length > 2000) errors.description = "Keep the description under 2000 characters.";

  if (values.price.trim() !== "") {
    if (!PRICE_PATTERN.test(values.price.trim())) {
      errors.price = "Enter a price in rupees with up to 2 decimals (for example 266 or 266.50).";
    }
  }

  if (!/^\d+$/.test(values.stockQuantity.trim())) {
    errors.stockQuantity = "Stock must be a whole number of 0 or more.";
  }

  if (!/^\d+$/.test(values.lowStockThreshold.trim())) {
    errors.lowStockThreshold = "Low-stock threshold must be a whole number of 0 or more.";
  }

  return errors;
}

export function validateStockAdjustment(delta: string, reason: string): { delta?: string; reason?: string } {
  const errors: { delta?: string; reason?: string } = {};
  const parsed = Number(delta);
  if (!Number.isInteger(parsed) || parsed === 0) {
    errors.delta = "Enter a non-zero whole number (negative to reduce stock).";
  }
  if (reason.trim().length < 3) {
    errors.reason = "Add a short reason so the adjustment can be audited.";
  } else if (reason.trim().length > 255) {
    errors.reason = "Keep the reason under 255 characters.";
  }
  return errors;
}

export function validateImageFile(file: File): string | null {
  const accepted = ["image/jpeg", "image/png", "image/webp"];
  if (!accepted.includes(file.type)) {
    return "Choose a JPG, PNG or WebP image.";
  }
  if (file.size > 5 * 1024 * 1024) {
    return "Images must be 5 MB or smaller.";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ *
 * Table sorting
 *
 * The admin list endpoints have no `sort` parameter, so sorting only
 * re-orders the rows already on the current page. Every screen that
 * offers it labels it as "this page" so the owner isn't misled into
 * thinking it sorts the whole result set.
 * ------------------------------------------------------------------ */

export type SortDirection = "asc" | "desc";

export type SortValue = string | number | boolean | null | undefined;

/**
 * Returns a new array sorted by `getValue`. Empty values always sort last,
 * regardless of direction, so a page never starts with blank rows.
 */
export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => SortValue,
  direction: SortDirection
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = getValue(a);
    const right = getValue(b);
    const leftEmpty = left === null || left === undefined || left === "";
    const rightEmpty = right === null || right === undefined || right === "";
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;
    if (typeof left === "number" && typeof right === "number") return (left - right) * factor;
    if (typeof left === "boolean" && typeof right === "boolean") {
      return Number(left) - Number(right) === 0 ? 0 : (Number(left) - Number(right)) * factor;
    }
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
  });
}

/** Next direction when a column header is activated (`none` → asc → desc → asc). */
export function nextSortDirection(
  current: SortDirection | null,
  clicked: boolean
): SortDirection {
  if (!clicked || current === null) return "asc";
  return current === "asc" ? "desc" : "asc";
}

/** Value for `aria-sort` on the active column; inactive columns omit it. */
export function ariaSortFor(direction: SortDirection | null): "ascending" | "descending" | "none" {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

/* ------------------------------------------------------------------ *
 * Currency parsing for sorting money that arrives as a decimal string
 * ------------------------------------------------------------------ */

export function parseMoney(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* ------------------------------------------------------------------ *
 * Inquiry status normalisation
 *
 * The backend stores whatever string it was given, so history contains
 * mixed casing ("PENDING", "pending", "Resolved"). Comparing normalised
 * values keeps badges, filters and "next status" consistent.
 * ------------------------------------------------------------------ */

export type NormalizedInquiryStatus = "PENDING" | "READ" | "RESOLVED";

/** Unknown values fall back to PENDING so an unexpected status is never shown as resolved. */
export function normalizeInquiryStatus(status: string | null | undefined): NormalizedInquiryStatus {
  const value = (status ?? "").trim().toUpperCase();
  if (value === "READ" || value === "RESOLVED") return value;
  return "PENDING";
}

export function nextInquiryStatus(status: string | null | undefined): NormalizedInquiryStatus {
  const current = normalizeInquiryStatus(status);
  return current === "PENDING" ? "READ" : current === "READ" ? "RESOLVED" : "PENDING";
}

/* ------------------------------------------------------------------ *
 * Error copy shown to the owner
 *
 * Internal wording ("The orders endpoint … See docs/admin-api-contract.md",
 * raw stack hints) must never reach the shop owner. Recovered errors keep
 * the server's message because those are already written for humans.
 * ------------------------------------------------------------------ */

const DEV_FACING_PATTERN =
  /(endpoint|docs\/|\.md\b|admin-api|api contract|\/api\/|prisma|stack trace|undefined is not)/i;

export function ownerErrorMessage(
  error: { status: number; message?: string } | null | undefined,
  resource: string
): string {
  if (!error || error.status === 0) {
    return `We couldn't reach the server to load ${resource}. Check your connection and try again.`;
  }
  if (error.status === 401) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (error.status === 403) {
    return "This account doesn't have access to that data.";
  }
  if (error.status === 404) {
    return `${capitalise(resource)} couldn't be found. It may have been removed.`;
  }
  if (error.status >= 500) {
    return `The server had a problem loading ${resource}. Please try again in a moment.`;
  }
  const message = error.message?.trim();
  if (message && !DEV_FACING_PATTERN.test(message)) return message;
  return `We couldn't load ${resource}. Please try again.`;
}

function capitalise(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}
