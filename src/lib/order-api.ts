import type { PaymentMethod } from "./payment";

export type OrderItem = {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  productCategory: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type OrderAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
};

export type OrderPayment = {
  method: string;
  status: string;
  ref: string | null;
};

export type Order = {
  id: number;
  customerId: number;
  status: string;
  total: string | null;
  createdAt: string;
  address?: OrderAddress;
  payment?: OrderPayment;
  items: OrderItem[];
};

export type OrderListResponse = {
  success: boolean;
  orders: Order[];
};

export type RazorpayOrder = {
  keyId: string;
  orderId: string;
  amountPaise: number;
};

export type PlaceOrderResponse = {
  success: boolean;
  order: Order;
  razorpay: RazorpayOrder | null;
  /** true when the server re-used an existing order for this idempotency key. */
  replay?: boolean;
  /** Present when the server answered with an order created by the same key. */
};

export type RetryPaymentResponse = {
  success: boolean;
  order: Order;
  razorpay: RazorpayOrder;
};

export type CheckoutPayload = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
};

/** Error with the HTTP status preserved so callers can branch on 401/404/409. */
export class OrderApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "OrderApiError";
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
    response = await fetch(`/api${path}`, {
      credentials: "include",
      ...options,
    });
  } catch {
    throw new OrderApiError(
      "Unable to reach the server. Check your connection and try again.",
      0
    );
  }

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new OrderApiError(
      errorMessage(
        data,
        response.status === 401
          ? "Please log in to view this order."
          : "Something went wrong. Please try again."
      ),
      response.status
    );
  }

  if (data && typeof data === "object" && (data as { success?: boolean }).success === false) {
    throw new OrderApiError(errorMessage(data, "Something went wrong. Please try again."), response.status);
  }

  return data as T;
}

export const orderApi = {
  list(): Promise<OrderListResponse> {
    return request<OrderListResponse>("/orders");
  },

  get(id: number): Promise<{ success: boolean; order: Order }> {
    return request<{ success: boolean; order: Order }>(`/orders/${id}`);
  },

  async placeOrder(
    payload: CheckoutPayload,
    options: { idempotencyKey?: string } = {}
  ): Promise<PlaceOrderResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.idempotencyKey) {
      headers["Idempotency-Key"] = options.idempotencyKey;
    }
    return request<PlaceOrderResponse>("/orders", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async verifyPayment(
    orderId: number,
    payload: { razorpayPaymentId: string; razorpaySignature: string }
  ): Promise<{ success: boolean; order: Order }> {
    return request<{ success: boolean; order: Order }>(
      `/orders/${orderId}/verify-payment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  },

  /** Starts a fresh Razorpay attempt for an order that is still unpaid. */
  async retryPayment(orderId: number): Promise<RetryPaymentResponse> {
    return request<RetryPaymentResponse>(`/orders/${orderId}/retry-payment`, {
      method: "POST",
    });
  },
};

export function formatOrderDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
