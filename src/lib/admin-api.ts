/**
 * Typed admin API client.
 *
 * Contract: docs/admin-api-contract.md (owned by Agent 1 frontend, implemented by Agent 2).
 * Every admin screen talks to the backend only through this module so there is a single
 * place to adjust if a payload changes.
 *
 * Auth: the browser sends the existing HttpOnly `jh_auth` cookie through the Next.js
 * `/api/*` rewrite. The server decides who is an admin; nothing here is a security boundary.
 */

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListResponse<T> = {
  success: true;
  data: T[];
  pagination: Pagination;
};

export type AdminRole = "ADMIN" | "CUSTOMER";

export type AdminIdentity = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  role: AdminRole;
};

export type AdminProduct = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: string | null;
  price: string | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasOrders: boolean;
};

export type AdminProductInput = {
  name: string;
  category: string;
  description: string;
  price: string | null;
  image: string | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
};

export type StockAdjustment = {
  id: number;
  delta: number;
  reason: string;
  previousQuantity: number;
  newQuantity: number;
  createdAt: string;
  admin: { id: number; fullName: string } | null;
};

export type AdminOrderCustomer = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
};

export type AdminOrderAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type AdminOrderItem = {
  productId: number;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type AdminOrderSummary = {
  id: number;
  createdAt: string;
  status: string;
  total: string | null;
  itemCount: number;
  customer: AdminOrderCustomer;
  shippingTo: { fullName: string; phone: string; city: string; pincode: string };
  payment: { method: string; status: string; ref: string | null };
};

export type AdminOrderStatusHistoryEntry = {
  id: number;
  status: string;
  note: string | null;
  at: string;
  by: string | null;
};

export type AdminOrder = AdminOrderSummary & {
  address: AdminOrderAddress;
  items: AdminOrderItem[];
  history: AdminOrderStatusHistoryEntry[];
  allowedTransitions: string[];
};

export type InquiryStatus = "PENDING" | "READ" | "RESOLVED";

export type AdminInquiry = {
  id: number;
  name: string;
  phone: string;
  email: string;
  product: string | null;
  message: string;
  status: InquiryStatus;
  internalNotes: string | null;
  createdAt: string;
};

export type AdminDashboard = {
  orders: {
    total: number;
    awaitingAction: number;
    processing: number;
    delivered: number;
    cancelled: number;
    todayCount: number;
  };
  payments: {
    verifiedCollected: string;
    verifiedCollectedOrders: number;
    codDue: string;
    codDueOrders: number;
    upiPending: string;
    upiPendingOrders: number;
    failed: string;
    failedOrders: number;
    nonCancelledOrderValue: string;
  };
  products: {
    total: number;
    active: number;
    inactive: number;
    lowStock: number;
    outOfStock: number;
  };
  inquiries: { total: number; new: number };
  recentOrders: AdminOrderSummary[];
  recentInquiries: AdminInquiry[];
};

export type OrderStatus = string;

/** Fulfilment statuses in the order the shop moves them through. */
export const ORDER_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
] as const;

export const PAYMENT_STATUSES = ["cod_due", "pending", "paid", "failed"] as const;

export const INQUIRY_STATUSES: InquiryStatus[] = ["PENDING", "READ", "RESOLVED"];

export const ADMIN_PRODUCT_CATEGORIES = [
  "Fertilizers",
  "Seeds",
  "Pesticides",
  "Agricultural Products",
] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Reports a 401 from an admin endpoint to the UX session guard. Registered by
 * `AdminAuthProvider` at runtime so this module stays React-free. A single
 * notification per page prevents redirect loops.
 */
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function setSessionExpiredListener(listener: SessionExpiredListener | null): void {
  sessionExpiredListener = listener;
}

function notifySessionExpired(status: number): void {
  if (status === 401) sessionExpiredListener?.();
}

export class AdminApiError extends Error {
  readonly status: number;
  /** Field errors keyed by field name, when the backend returns `errors`. */
  readonly fields: Record<string, string> | undefined;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.fields = fields;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function readFields(data: unknown): Record<string, string> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const errors = (data as { errors?: unknown; fieldErrors?: unknown }).errors ??
    (data as { fieldErrors?: unknown }).fieldErrors;
  if (!errors || typeof errors !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    if (typeof value === "string" && value) out[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function statusFallback(status: number): string {
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "This account doesn't have access to the admin area.";
  if (status === 404) return "That record no longer exists.";
  if (status === 413) return "That file is too large.";
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/admin${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      signal: options.signal,
      headers:
        options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AdminApiError(
      "Unable to reach the server. Check your connection and try again.",
      0
    );
  }

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    notifySessionExpired(response.status);
    throw new AdminApiError(
      readMessage(data, statusFallback(response.status)),
      response.status,
      readFields(data)
    );
  }

  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    throw new AdminApiError(readMessage(data, statusFallback(response.status)), response.status);
  }

  return data as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export type ProductFilters = {
  q?: string;
  category?: string;
  availability?: "" | "active" | "inactive" | "low_stock" | "out_of_stock";
  page?: number;
  pageSize?: number;
};

export type OrderFilters = {
  q?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  pageSize?: number;
};

export type InquiryFilters = {
  q?: string;
  status?: "" | InquiryStatus;
  page?: number;
  pageSize?: number;
};

export type InventoryFilters = {
  q?: string;
  filter?: "" | "low" | "out" | "ok";
  page?: number;
  pageSize?: number;
};

export const adminApi = {
  /** Server-verified identity. `role` must come from the backend (see contract §1). */
  async me(): Promise<AdminIdentity | null> {
    const response = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json().catch(() => null)) as
      | { customer?: AdminIdentity }
      | null;
    const customer = data?.customer;
    if (!customer) return null;
    return { ...customer, role: customer.role ?? "CUSTOMER" };
  },

  dashboard(signal?: AbortSignal): Promise<{ success: true; data: AdminDashboard }> {
    return request("/dashboard", { signal });
  },

  orders(filters: OrderFilters = {}, signal?: AbortSignal): Promise<ListResponse<AdminOrderSummary>> {
    return request(`/orders${query({ ...filters })}`, { signal });
  },

  order(id: number, signal?: AbortSignal): Promise<{ success: true; order: AdminOrder }> {
    return request(`/orders/${id}`, { signal });
  },

  updateOrderStatus(
    id: number,
    input: { status: OrderStatus; note?: string }
  ): Promise<{ success: true; order: AdminOrder }> {
    return request(`/orders/${id}/status`, { method: "POST", body: input });
  },

  products(
    filters: ProductFilters = {},
    signal?: AbortSignal
  ): Promise<ListResponse<AdminProduct>> {
    return request(`/products${query({ ...filters })}`, { signal });
  },

  product(id: number, signal?: AbortSignal): Promise<{ success: true; product: AdminProduct }> {
    return request(`/products/${id}`, { signal });
  },

  createProduct(input: AdminProductInput): Promise<{ success: true; product: AdminProduct }> {
    return request("/products", { method: "POST", body: input });
  },

  updateProduct(
    id: number,
    input: Partial<AdminProductInput>
  ): Promise<{ success: true; product: AdminProduct }> {
    return request(`/products/${id}`, { method: "PATCH", body: input });
  },

  archiveProduct(id: number): Promise<{ success: true; product: AdminProduct }> {
    return request(`/products/${id}/archive`, { method: "POST" });
  },

  restoreProduct(id: number): Promise<{ success: true; product: AdminProduct }> {
    return request(`/products/${id}/restore`, { method: "POST" });
  },

  removeProductImage(id: number): Promise<{ success: true; product: AdminProduct }> {
    return request(`/products/${id}/image`, { method: "DELETE" });
  },

  /**
   * Multipart upload. Kept separate from `request` so progress can be tracked with
   * XMLHttpRequest (fetch has no upload progress events).
   */
  uploadProductImage(
    id: number,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ success: true; product: AdminProduct }> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("image", file, file.name);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/products/${id}/image`);
      xhr.withCredentials = true;
      xhr.responseType = "json";

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onerror = () => {
        reject(new AdminApiError("Upload failed. Check your connection and try again.", 0));
      };

      xhr.onload = () => {
        const data = xhr.response as unknown;
        notifySessionExpired(xhr.status);
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve(data as { success: true; product: AdminProduct });
          return;
        }
        reject(
          new AdminApiError(
            readMessage(data, statusFallback(xhr.status)),
            xhr.status,
            readFields(data)
          )
        );
      };

      xhr.send(form);
    });
  },

  inventory(
    filters: InventoryFilters = {},
    signal?: AbortSignal
  ): Promise<ListResponse<AdminProduct>> {
    return request(`/inventory${query({ ...filters })}`, { signal });
  },

  adjustStock(
    productId: number,
    input: { delta: number; reason: string }
  ): Promise<{
    success: true;
    product: AdminProduct;
    adjustment: StockAdjustment;
  }> {
    return request(`/products/${productId}/stock`, { method: "POST", body: input });
  },

  stockAdjustments(
    productId: number,
    params: { page?: number; pageSize?: number } = {},
    signal?: AbortSignal
  ): Promise<ListResponse<StockAdjustment>> {
    return request(`/products/${productId}/stock-adjustments${query({ ...params })}`, { signal });
  },

  inquiries(
    filters: InquiryFilters = {},
    signal?: AbortSignal
  ): Promise<ListResponse<AdminInquiry>> {
    return request(`/inquiries${query({ ...filters })}`, { signal });
  },

  updateInquiry(
    id: number,
    input: { status?: InquiryStatus; internalNotes?: string | null }
  ): Promise<{ success: true; inquiry: AdminInquiry }> {
    return request(`/inquiries/${id}`, { method: "PATCH", body: input });
  },
};

// ---------------------------------------------------------------------------
// Shared formatting helpers (display only)
// ---------------------------------------------------------------------------

export function formatMoney(value: string | null | undefined, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const number = parseFloat(value);
  if (!Number.isFinite(number)) return fallback;
  return `₹${number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function productStockState(
  product: Pick<AdminProduct, "stockQuantity" | "lowStockThreshold" | "available">
): "out" | "low" | "ok" {
  if (product.stockQuantity <= 0) return "out";
  if (product.stockQuantity <= product.lowStockThreshold) return "low";
  return "ok";
}

export function moneyInputToApi(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}
