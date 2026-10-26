import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPurchasable, purchaseBlockedReason } from "./product-purchase";

describe("customer purchase gating (product-purchase)", () => {
  it("blocks admin-unavailable products regardless of stock", () => {
    assert.equal(isPurchasable({ available: false, stockQuantity: 12 }), false);
    assert.equal(purchaseBlockedReason({ available: false, stockQuantity: 0 }), "unavailable");
    assert.equal(purchaseBlockedReason({ available: false, stockQuantity: 5 }), "unavailable");
  });

  it("blocks zero stock even when the available flag is still set", () => {
    // Regression for the release-audit finding: checkout protected the
    // customer but the storefront still offered "Add to Cart" at stock 0.
    assert.equal(isPurchasable({ available: true, stockQuantity: 0 }), false);
    assert.equal(purchaseBlockedReason({ available: true, stockQuantity: 0 }), "out-of-stock");
  });

  it("allows purchasable products", () => {
    assert.equal(isPurchasable({ available: true, stockQuantity: 7 }), true);
    assert.equal(purchaseBlockedReason({ available: true, stockQuantity: 7 }), null);
    assert.equal(isPurchasable({ available: true, stockQuantity: 1 }), true);
  });

  it("treats a missing stock field as flag-driven only (older API shapes)", () => {
    assert.equal(isPurchasable({ available: true }), true);
    assert.equal(isPurchasable({ available: false }), false);
  });

  it("blocks negative/undefined numeric stock defensively", () => {
    assert.equal(isPurchasable({ available: true, stockQuantity: -1 }), false);
    assert.equal(isPurchasable({ available: true, stockQuantity: null }), false);
  });
});
