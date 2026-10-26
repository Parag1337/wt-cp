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

export const cartApi = {
  get(): Promise<CartResponse> {
    return fetch("/api/cart", {
      credentials: "include",
    }).then((r) => {
      if (r.status === 401) {
        return { success: true, cart: { id: null, items: [], totalItems: 0, subtotal: null } } as CartResponse;
      }
      return r.json();
    });
  },

  add(productId: number, quantity = 1): Promise<CartResponse> {
    return fetch("/api/cart/items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity }),
    }).then((r) => r.json());
  },

  update(itemId: number, quantity: number): Promise<CartResponse> {
    return fetch(`/api/cart/items/${itemId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }).then((r) => r.json());
  },

  remove(itemId: number): Promise<CartResponse> {
    return fetch(`/api/cart/items/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => r.json());
  },

  clear(): Promise<CartResponse> {
    return fetch("/api/cart", {
      method: "DELETE",
      credentials: "include",
    }).then((r) => r.json());
  },
};
