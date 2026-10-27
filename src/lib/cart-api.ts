export type CartItem = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string;
  productImage: string | null;
  unitPrice: string | null;
  available: boolean;
  quantity: number;
};

export type Cart = {
  id: number | null;
  items: CartItem[];
  totalItems: number;
  subtotal: string | null;
};

export type CartResponse = {
  success: boolean;
  cart: Cart;
};

/** Error with the HTTP status preserved so callers can branch on 401/404/409. */
export class CartApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CartApiError";
    this.status = status;
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "include", ...options });
  } catch {
    throw new CartApiError("Unable to reach the server. Check your connection and try again.", 0);
  }

  const data = (await response.json().catch(() => null)) as unknown;

  const method = (options.method ?? "GET").toUpperCase();
  if (response.status === 401 && method === "GET") {
    return { success: true, cart: { id: null, items: [], totalItems: 0, subtotal: null } } as T;
  }

  if (!response.ok) {
    throw new CartApiError(
      errorMessage(
        data,
        response.status === 401
          ? "Please log in to manage your cart."
          : "Something went wrong. Please try again."
      ),
      response.status
    );
  }

  const parsed = data as T;
  if (parsed && typeof parsed === "object" && (parsed as { success?: boolean }).success === false) {
    throw new CartApiError(errorMessage(parsed, "Something went wrong. Please try again."), response.status);
  }
  if (parsed && typeof parsed === "object" && !(parsed as { cart?: unknown }).cart) {
    throw new CartApiError("Invalid cart response.", response.status);
  }
  return parsed;
}

export const cartApi = {
  get(): Promise<CartResponse> {
    return request<CartResponse>("/api/cart");
  },

  add(productId: number, quantity = 1): Promise<CartResponse> {
    return request<CartResponse>("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    });
  },

  update(itemId: number, quantity: number): Promise<CartResponse> {
    return request<CartResponse>(`/api/cart/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
  },

  remove(itemId: number): Promise<CartResponse> {
    return request<CartResponse>(`/api/cart/items/${itemId}`, {
      method: "DELETE",
    });
  },

  clear(): Promise<CartResponse> {
    return request<CartResponse>("/api/cart", {
      method: "DELETE",
    });
  },
};
