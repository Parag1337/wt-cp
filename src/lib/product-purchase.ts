import type { Product } from "./api";

/**
 * Purchasability gate shared by the storefront product rows and detail pages.
 *
 * The backend stays the authoritative stock validator at checkout ("stock on
 * order" contract, docs/admin-api-contract.md §6); this helper only keeps the
 * UI from offering a purchase that cannot succeed:
 *
 * - `available: false`  → admin-disabled, never auto-purchasable again.
 * - stock 0 / missing → not purchasable until stock returns (an order
 *   cancellation restores stock and therefore purchasability — the flag is
 *   never touched by inventory logic, so nothing can go stale here).
 */
export function isPurchasable(product: {
  available: boolean;
  stockQuantity?: number | null;
}): boolean {
  if (!product.available) return false;
  if (payloadHasStockField(product)) return (product.stockQuantity ?? 0) > 0;
  // Legacy/older API responses without the field: fall back to the flag.
  return true;
}

function payloadHasStockField(product: { stockQuantity?: number | null }): boolean {
  // `undefined` = field absent (legacy shape); `null`/number = server told us.
  return product.stockQuantity !== undefined;
}

/**
 * Owner-friendly reason for a blocked purchase, or null when purchasable.
 * Used for button labels and stock indicators ("Out of stock", etc.).
 */
export function purchaseBlockedReason(product: {
  available: boolean;
  stockQuantity?: number | null;
}): "unavailable" | "out-of-stock" | null {
  if (isPurchasable(product)) return null;
  return product.available ? "out-of-stock" : "unavailable";
}

export type ProductLike = Partial<Product> & {
  available: boolean;
  stockQuantity?: number | null;
};
