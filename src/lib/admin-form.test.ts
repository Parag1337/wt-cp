import test from "node:test";
import assert from "node:assert/strict";
import {
  buildListQuery,
  formatBytes,
  productToForm,
  readFilters,
  readPage,
  validateImageFile,
  validateProductForm,
  validateStockAdjustment,
  EMPTY_PRODUCT_FORM,
  ariaSortFor,
  nextInquiryStatus,
  nextSortDirection,
  normalizeInquiryStatus,
  ownerErrorMessage,
  parseMoney,
  sortRows,
} from "./admin-form.js";

const CATEGORIES = ["Fertilizers", "Seeds", "Pesticides", "Agricultural Products"];

test("readFilters/readPage parse deep-link params safely", () => {
  const params = new URLSearchParams("status=pending&page=3");
  assert.deepEqual(readFilters(params, ["status", "q"]), { status: "pending", q: "" });
  assert.equal(readPage(params), 3);
  assert.equal(readPage(new URLSearchParams("page=0")), 1);
  assert.equal(readPage(new URLSearchParams("page=abc")), 1);
  assert.equal(readPage(new URLSearchParams("")), 1);
});

test("buildListQuery drops empty values and the first page", () => {
  assert.deepEqual(buildListQuery({ q: "", status: "pending", pageSize: 20 }, 1), {
    status: "pending",
    pageSize: 20,
  });
  assert.deepEqual(buildListQuery({ q: "urea" }, 2), { q: "urea", page: 2 });
});

test("product form validation: happy path and each required field", () => {
  const valid = { ...EMPTY_PRODUCT_FORM, name: "Urea", description: "Nitrogen fertiliser", price: "266.50" };
  assert.deepEqual(validateProductForm(valid, CATEGORIES), {});

  assert.ok(validateProductForm({ ...valid, name: " " }, CATEGORIES).name);
  assert.ok(validateProductForm({ ...valid, description: "" }, CATEGORIES).description);
  assert.ok(validateProductForm({ ...valid, category: "Nope" }, CATEGORIES).category);
  assert.ok(validateProductForm({ ...valid, price: "12.345" }, CATEGORIES).price);
  assert.ok(validateProductForm({ ...valid, price: "-5" }, CATEGORIES).price);
  assert.ok(validateProductForm({ ...valid, stockQuantity: "-1" }, CATEGORIES).stockQuantity);
  assert.ok(validateProductForm({ ...valid, lowStockThreshold: "2.5" }, CATEGORIES).lowStockThreshold);

  // "Price on request" is allowed.
  assert.deepEqual(validateProductForm({ ...valid, price: "" }, CATEGORIES), {});
});

test("productToForm round-trips server values", () => {
  const product = {
    id: 1, name: "DAP", category: "Fertilizers", description: "d", image: null,
    price: null, available: false, stockQuantity: 3, lowStockThreshold: 5,
    archivedAt: null, createdAt: "", updatedAt: "", hasOrders: true,
  };
  const form = productToForm(product);
  assert.equal(form.price, "");
  assert.equal(form.available, false);
  assert.equal(form.stockQuantity, "3");
});

test("stock adjustment validation requires non-zero whole delta and a reason", () => {
  assert.deepEqual(validateStockAdjustment("5", "Delivery"), {});
  assert.deepEqual(validateStockAdjustment("-5", "Damaged bags"), {});
  assert.ok(validateStockAdjustment("0", "Delivery").delta);
  assert.ok(validateStockAdjustment("1.5", "Delivery").delta);
  assert.ok(validateStockAdjustment("", "Delivery").delta);
  assert.ok(validateStockAdjustment("5", "  ").reason);
  assert.ok(validateStockAdjustment("5", "x".repeat(256)).reason);
});

test("image upload validation enforces type and 5 MB size", () => {
  const file = (type: string, size: number) => ({ type, size, name: "x" }) as File;
  assert.equal(validateImageFile(file("image/png", 1024)), null);
  assert.equal(validateImageFile(file("image/webp", 5 * 1024 * 1024)), null);
  assert.ok(validateImageFile(file("application/pdf", 1024)));
  assert.ok(validateImageFile(file("image/png", 5 * 1024 * 1024 + 1)));
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(2 * 1024 * 1024), "2.0 MB");
});

test("sortRows sorts numbers, strings and booleans without mutating the input", () => {
  const rows = [
    { id: 1, total: "266.00", name: "Urea", flag: true },
    { id: 2, total: null, name: "dap", flag: false },
    { id: 3, total: "1400.50", name: "Seeds 10", flag: true },
  ];
  const original = [...rows];

  const byTotal = sortRows(rows, (row) => parseMoney(row.total), "asc");
  assert.deepEqual(byTotal.map((row) => row.id), [1, 3, 2], "null total sorts last");
  assert.deepEqual(sortRows(rows, (row) => parseMoney(row.total), "desc").map((r) => r.id), [3, 1, 2]);

  assert.deepEqual(sortRows(rows, (row) => row.name, "asc").map((r) => r.id), [2, 3, 1]);
  assert.deepEqual(sortRows(rows, (row) => row.flag, "asc").map((r) => r.id), [2, 1, 3]);
  assert.deepEqual(rows, original, "input array is untouched");
  assert.deepEqual(sortRows([], (row: number) => row, "asc"), []);
});

test("nextSortDirection and ariaSortFor describe the table state", () => {
  assert.equal(nextSortDirection(null, false), "asc");
  assert.equal(nextSortDirection("desc", false), "asc");
  assert.equal(nextSortDirection("asc", true), "desc");
  assert.equal(nextSortDirection("desc", true), "asc");
  assert.equal(ariaSortFor("asc"), "ascending");
  assert.equal(ariaSortFor("desc"), "descending");
  assert.equal(ariaSortFor(null), "none");
});

test("parseMoney reads decimal strings and rejects blanks", () => {
  assert.equal(parseMoney("1295.00"), 1295);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney(null), null);
  assert.equal(parseMoney("not a price"), null);
});

test("inquiry statuses are normalised across casings", () => {
  assert.equal(normalizeInquiryStatus("pending"), "PENDING");
  assert.equal(normalizeInquiryStatus(" Resolved "), "RESOLVED");
  assert.equal(normalizeInquiryStatus("READ"), "READ");
  assert.equal(normalizeInquiryStatus(""), "PENDING");
  assert.equal(normalizeInquiryStatus(null), "PENDING");
  assert.equal(normalizeInquiryStatus("something-new"), "PENDING");
  assert.equal(nextInquiryStatus("pending"), "READ");
  assert.equal(nextInquiryStatus("READ"), "RESOLVED");
  assert.equal(nextInquiryStatus("resolved"), "PENDING");
});

test("ownerErrorMessage hides developer-facing text and explains status codes", () => {
  const devCopy =
    "The orders endpoint (GET /api/admin/orders) isn't available yet. See docs/admin-api-contract.md.";
  const message = ownerErrorMessage({ status: 404, message: devCopy }, "orders");
  assert.doesNotMatch(message, /endpoint|docs|\/api\//);
  assert.match(message, /couldn't be found/);

  assert.match(ownerErrorMessage({ status: 0 }, "orders"), /couldn't reach the server/);
  assert.match(ownerErrorMessage({ status: 401 }, "orders"), /session has expired/);
  assert.match(ownerErrorMessage({ status: 403 }, "orders"), /access/);
  assert.match(ownerErrorMessage({ status: 500, message: "Prisma error" }, "orders"), /server had a problem/);
  // Server messages written for humans are kept.
  assert.equal(
    ownerErrorMessage({ status: 400, message: "Enter a price in rupees with up to 2 decimals." }, "products"),
    "Enter a price in rupees with up to 2 decimals."
  );
  assert.match(ownerErrorMessage(null, "inventory"), /load inventory/);
});
