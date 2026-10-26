"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
import { cartApi, type Cart, type CartItem } from "./cart-api";
import { useAuth } from "./auth-context";

type CartStatus = "loading" | "ready" | "error";

type CartContextValue = {
  status: CartStatus;
  cart: Cart;
  refresh: () => Promise<void>;
  addItem: (productId: number, quantity?: number) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
  isInCart: (productId: number) => boolean;
};

const EMPTY_CART: Cart = {
  id: null,
  items: [],
  totalItems: 0,
  subtotal: null,
};

let currentCart: Cart = EMPTY_CART;
let currentStatus: CartStatus = "loading";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function setCartState(cart: Cart, status: CartStatus) {
  currentCart = cart;
  currentStatus = status;
  notify();
}

function useCartStore(): CartContextValue {
  const authStatus = useAuth().status;

  const cart = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => currentCart,
    () => EMPTY_CART
  );

  const status = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => currentStatus,
    () => "loading" as CartStatus
  );

  const refresh = useCallback(async () => {
    if (authStatus !== "authenticated") {
      setCartState(EMPTY_CART, "ready");
      return;
    }
    try {
      const data = await cartApi.get();
      setCartState(data.cart, "ready");
    } catch {
      setCartState(EMPTY_CART, "error");
    }
  }, [authStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId: number, quantity = 1) => {
      if (authStatus !== "authenticated") return;
      const data = await cartApi.add(productId, quantity);
      setCartState(data.cart, "ready");
    },
    [authStatus]
  );

  const updateItem = useCallback(
    async (itemId: number, quantity: number) => {
      if (authStatus !== "authenticated") return;
      const data = await cartApi.update(itemId, quantity);
      setCartState(data.cart, "ready");
    },
    [authStatus]
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      if (authStatus !== "authenticated") return;
      const data = await cartApi.remove(itemId);
      setCartState(data.cart, "ready");
    },
    [authStatus]
  );

  const clear = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const data = await cartApi.clear();
    setCartState(data.cart, "ready");
  }, [authStatus]);

  const isInCart = useCallback(
    (productId: number) => cart.items.some((item) => item.productId === productId),
    [cart.items]
  );

  return { status, cart, refresh, addItem, updateItem, removeItem, clear, isInCart };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const value = useCartStore();
  // We don't actually need to render a context provider since we use a module-level store
  // But we keep the component for API compatibility
  return <>{children}</>;
}

export function useCart(): CartContextValue {
  return useCartStore();
}
