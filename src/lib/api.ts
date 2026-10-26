export type Product = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: string | null;
  price: string | null;
  available: boolean;
  /** Server stock snapshot; also always present on the API (additive type). */
  stockQuantity?: number;
};

export type ProductListResponse = {
  success: boolean;
  products: Product[];
  total: number;
  categories: string[];
};

export type ProductDetailResponse = {
  success: boolean;
  product: Product;
};

export type InquiryPayload = {
  name: string;
  phone: string;
  email: string;
  product?: string | null;
  message: string;
};

export type InquiryResponse = {
  success: boolean;
  message: string;
};

async function handleResponse<T extends { success: boolean; message?: string }>(
  r: Response
): Promise<T> {
  const data = (await r.json().catch(() => null)) as T | null;
  if (!r.ok || !data || data.success === false) {
    const message =
      data && typeof data.message === "string" && data.message
        ? data.message
        : "We couldn't load this right now. Please try again.";
    throw new Error(message);
  }
  return data;
}

export const productApi = {
  list(params?: {
    q?: string;
    category?: string;
  }): Promise<ProductListResponse> {
    const search = new URLSearchParams();
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    const query = search.toString();
    return fetch(`/api/products${query ? `?${query}` : ""}`, {
      credentials: "include",
    }).then(handleResponse<ProductListResponse>);
  },

  get(id: number): Promise<ProductDetailResponse> {
    return fetch(`/api/products/${id}`, {
      credentials: "include",
    }).then(handleResponse<ProductDetailResponse>);
  },
};

export const inquiryApi = {
  submit(payload: InquiryPayload): Promise<InquiryResponse> {
    return fetch("/api/inquiries", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handleResponse<InquiryResponse>);
  },
};
