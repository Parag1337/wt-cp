import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";

/**
 * B-4 regression: the in-memory rate limiter now guards the customer auth
 * routes (register/login) and the public inquiry surface.
 *
 * The limiter is keyed by `${ip}:${path}` and resets after the window
 * (RATE_LIMIT_WINDOW_MS). This file sets small budgets via env vars BEFORE
 * the config module loads, spins its own app instance, and runs in its own
 * test process — so the shared bucket starts empty and no other suite is
 * affected.
 */
process.env.AUTH_RATE_LIMIT_MAX = "3";
process.env.INQUIRY_RATE_LIMIT_MAX = "2";
process.env.RATE_LIMIT_WINDOW_MS = "60000";

const { app } = await import("../src/app.js");
const { prisma } = await import("../src/config/prisma.js");

const suffix = Date.now();
const email = `ratelimit_${suffix}@cartguard.test`;
const password = "ratelimitpass1";
let baseUrl = "";
let server: ReturnType<typeof app.listen> | null = null;

async function api(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server!.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;

  await prisma.customer.create({
    data: {
      fullName: "Rate Limit Probe",
      email,
      phone: `7${`${suffix}`.slice(-9)}`,
      passwordHash: await bcrypt.hash(password, 10),
      role: "CUSTOMER",
    },
  });
});

test.after(async () => {
  await prisma.customer.deleteMany({ where: { email: { startsWith: "ratelimit-" } } });
  await prisma.inquiry.deleteMany({ where: { email: { startsWith: "ratelimit-inquiry-" } } });
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await prisma.$disconnect();
});

test("a normal login well under the budget succeeds", async () => {
  const res = await api("/api/auth/login", { email, password });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.success, true);
});

test("register bursts are throttled with a consistent 429 shape", async () => {
  // budget AUTH_RATE_LIMIT_MAX=3 for /api/auth/register in this window
  const ok = await api("/api/auth/register", {
    fullName: "Rate Limit Burst",
    email: `ratelimit-burst-${suffix}@cartguard.test`,
    phone: `6${`${suffix}`.slice(-9)}`,
    password,
  });
  assert.equal(ok.status, 201);

  await api("/api/auth/register", {
    fullName: "Rate Limit Burst 2",
    email: `ratelimit-burst2-${suffix}@cartguard.test`,
    phone: `9${`${suffix}`.slice(-9)}`,
    password,
  });
  await api("/api/auth/register", {
    fullName: "Rate Limit Burst 3",
    email: `ratelimit-burst3-${suffix}@cartguard.test`,
    phone: `8${`${suffix}`.slice(-9)}`,
    password,
  });

  const throttled = await api("/api/auth/register", {
    fullName: "Rate Limit Burst 4",
    email: `ratelimit-burst4-${suffix}@cartguard.test`,
    phone: `7${`${suffix}`.slice(-9)}`,
    password,
  });
  assert.equal(throttled.status, 429);
  assert.equal(throttled.json.success, false);
  assert.match(String(throttled.json.message), /too many requests/i);
});

test("login bursts are throttled and legitimate single attempts still pass", async () => {
  // one request at a time stays fine until the budget is spent
  const wrong = await api("/api/auth/login", { email, password: "wrong-password" });
  assert.ok(wrong.status !== 429, "the first attempt must not be throttled");

  await api("/api/auth/login", { email, password: "wrong-password" });
  await api("/api/auth/login", { email, password: "wrong-password" });
  const throttled = await api("/api/auth/login", { email, password: "wrong-password" });
  assert.equal(throttled.status, 429);
  assert.equal(throttled.json.success, false);
  assert.match(String(throttled.json.message), /too many requests/i);
});

test("inquiry bursts are throttled; the first honest submission passes", async () => {
  const first = await api("/api/inquiries", {
    name: "Rate Limit Probe",
    phone: `7${`${suffix}`.slice(-9)}`,
    email: `ratelimit-inquiry-${suffix}@cartguard.test`,
    message: "How much for a bulk bag of gram seeds this season?",
  });
  assert.equal(first.status, 201, JSON.stringify(first.json));

  const second = await api("/api/inquiries", {
    name: "Rate Limit Probe",
    phone: `7${`${suffix}`.slice(-9)}`,
    email: `ratelimit-inquiry-${suffix}@cartguard.test`,
    message: "Second honest retry within one window.",
  });
  assert.equal(second.status, 201, JSON.stringify(second.json));

  const throttled = await api("/api/inquiries", {
    name: "Rate Limit Probe",
    phone: `7${`${suffix}`.slice(-9)}`,
    email: `ratelimit-inquiry-${suffix}@cartguard.test`,
    message: "Third attempt against a budget of two.",
  });
  assert.equal(throttled.status, 429);
  assert.equal(throttled.json.success, false);
  assert.match(String(throttled.json.message), /too many requests/i);
});

test("other GET routes are not throttled (limits scope to the intended writes)", async () => {
  const res = await fetch(`${baseUrl}/api/products`);
  assert.equal(res.status, 200);
});
