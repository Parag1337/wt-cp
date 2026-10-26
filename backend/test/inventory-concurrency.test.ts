import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/config/prisma.js";
import { adjustStock } from "../src/services/admin-inventory.service.js";

/**
 * Concurrent inventory adjustments (priority 4 — assessments without stock
 * reservation). The inventory screen keeps sole ownership of stock; these
 * tests prove that concurrent admin adjustments serialize on the live stock
 * value instead of interleaving lost updates, and that the audit trail
 * (`stock_adjustments`) chains consistently through every concurrent write.
 */

const suffix = String(Date.now()).slice(-9);
const productName = `Inventory Concurrency ${suffix}`;

let productId = 0;
let adminId = 0;
const baseStock = 5;

async function admin() {
  const admin = await prisma.customer.findFirst({
    where: { role: "ADMIN" },
    orderBy: { id: "asc" },
  });
  if (!admin) throw new Error("no admin account in the development database for admin_id");
  adminId = admin.id;
}

after(async () => {
  if (productId) {
    await prisma.stockAdjustment.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
  }
  await prisma.$disconnect();
});

test("concurrent delta adjustments apply every unit and keep the audit chain consistent", async () => {
  const product = await prisma.product.create({
    data: {
      name: productName,
      category: "Agricultural Products",
      description: "Temporary product for inventory concurrency tests.",
      price: 100,
      available: true,
      stockQuantity: baseStock,
    },
  });
  productId = product.id;
  await admin();

  const calls = [-1, -1, -1, -1, +2, +2, +2] as const; // net +2 -> 5-4+6 = 7
  const results = await Promise.allSettled(
    calls.map((delta) => adjustStock(productId, adminId, { delta, reason: "concurrency test" }))
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(
    fulfilled.length,
    calls.length,
    `every adjustment succeeds: ${results
      .map((r) => (r.status === "rejected" ? String(r.reason) : "ok"))
      .join(", ")}`
  );

  const final = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(
    final.stockQuantity,
    baseStock - 4 + 6,
    "every concurrent unit is accounted for (no lost updates)"
  );

  // Audit chain: order the writes by id; every audit row's previous must equal
  // the previous row's new quantity, starting at the base stock. This is only
  // possible if adjustments serialized on the current value.
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { productId },
    orderBy: { id: "asc" },
  });
  assert.equal(adjustments.length, calls.length);
  let expectedPrevious = baseStock;
  for (const row of adjustments) {
    assert.equal(
      row.previousQuantity,
      expectedPrevious,
      `audit row ${row.id} read stale stock: previous ${row.previousQuantity} !== ${expectedPrevious}`
    );
    expectedPrevious = row.newQuantity;
  }
  assert.equal(expectedPrevious, final.stockQuantity);
});

test("concurrent negative deltas cannot oversell below zero", async () => {
  const product = await prisma.product.create({
    data: {
      name: `${productName} negative`,
      category: "Agricultural Products",
      description: "Temporary product for negative-stock tests.",
      price: 100,
      available: true,
      stockQuantity: 2,
    },
  });
  productId = product.id;
  await admin();

  const results = await Promise.allSettled(
    [0, 1, 2, 3].map(() => adjustStock(productId, adminId, { delta: -1, reason: "sell" }))
  );
  const fulfilled = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected");

  const final = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(final.stockQuantity, 0, "stock is never negative");
  assert.ok(fulfilled >= 1, "at least one decrement applies");
  assert.ok(fulfilled <= 2, "no more than the available units can decrement");
  assert.equal(rejected.length + fulfilled, 4);
  for (const rejectedResult of rejected) {
    assert.match(String(rejectedResult.reason), /negative/i);
  }

  await prisma.stockAdjustment.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  productId = 0;
});
