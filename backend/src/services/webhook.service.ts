import crypto from "node:crypto";
import { Prisma } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { getRazorpayClient } from "./payment.service.js";
import {
  InsufficientStockError,
  captureDeductionEventId,
  claimStockEvent,
  deductStockWithinTx,
} from "./stock-ledger.service.js";

/**
 * Razorpay webhook intake, signature verification, and reconciliation.
 *
 * Contract (docs/ordering-flow.md §4, docs/production-readiness.md §2):
 * - The route is served with a route-scoped `express.raw()`, so the HMAC is
 *   computed over the exact bytes Razorpay signed — never over a re-serialized
 *   JSON body.
 * - Every delivered event is recorded in `webhook_events`; the unique
 *   (provider, event_id) index makes redeliveries idempotent: the second
 *   delivery hits a unique violation and is acknowledged without reprocessing.
 * - `payment.captured` / `order.paid` reconcile the local order to `paid`
 *   through a conditional update, so a webhook racing the browser's
 *   verify-payment callback converges on the same final state instead of
 *   writing twice.
 */

export const WEBHOOK_RAW_BODY_LIMIT = "256kb";

const RAZORPAY_SIGNATURE_HEADER = "x-razorpay-signature";
const RAZORPAY_EVENT_ID_HEADER = "x-razorpay-event-id";
const MAX_EVENT_ID_LENGTH = 64;

type WebhookPaymentEntity = {
  id?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  captured?: boolean;
  method?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
};

type WebhookEventPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: WebhookPaymentEntity };
    order?: { entity?: { id?: string; amount?: number | string } };
  };
};

export function isWebhookVerificationEnabled(): boolean {
  return !!process.env.RAZORPAY_WEBHOOK_SECRET;
}

/** Timing-safe HMAC-SHA256(raw signed bytes) check against the webhook secret. */
export function verifyWebhookSignature(rawBody: Buffer, signature: unknown): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (
    !secret ||
    !rawBody ||
    rawBody.length === 0 ||
    typeof signature !== "string" ||
    signature.length === 0
  ) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function normaliseRazorpayPayment(entity: WebhookPaymentEntity): {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: string;
  captured: boolean;
} | null {
  if (!entity.id || !entity.order_id) return null;
  const amountPaise = Number(entity.amount);
  if (!Number.isInteger(amountPaise)) return null;
  return {
    id: entity.id,
    orderId: entity.order_id,
    amountPaise,
    currency: entity.currency ?? "",
    status: entity.status ?? "",
    captured: entity.captured === true || entity.status === "captured",
  };
}

export type WebhookOutcome =
  | { acknowledged: true; note: string }
  | { acknowledged: true; note: string; orderUpdated: true };

/** Records the event row (unique per provider+id) or reports a redelivery. */
async function claimWebhookEvent(eventId: string, eventType: string) {
  try {
    return await prisma.webhookEvent.create({
      data: { provider: "razorpay", eventId, eventType, status: "received" },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null; // redelivery of an event already claimed
    }
    throw error;
  }
}

/**
 * Reconciles one captured Razorpay payment against the local order.
 * Shared by the webhook dispatcher and the pending-order sweeper, so both
 * paths use exactly the same guarantees and outcome encoding.
 */
export async function applyCapturedRazorpayPayment(
  razorpayOrderId: string,
  payment: {
    id: string;
    amountPaise: number;
    currency: string;
    captured: boolean;
    status?: string;
  }
): Promise<{ eventStatus: "processed" | "ignored" | "failed"; note: string }> {
  const order = await prisma.order.findFirst({
    where: { razorpayOrderId },
  });

  if (!order) {
    return { eventStatus: "ignored", note: `no local order for ${razorpayOrderId}` };
  }

  if (order.paymentMethod !== "razorpay") {
    return {
      eventStatus: "ignored",
      note: `order ${order.id} does not use online payment`,
    };
  }

  const expectedAmountPaise = Math.round(
    Number(order.total ? order.total.toString() : 0) * 100
  );
  if (payment.amountPaise !== expectedAmountPaise) {
    return {
      eventStatus: "failed",
      note: `amount mismatch: provider ${payment.amountPaise} vs order ${expectedAmountPaise}`,
    };
  }

  if (payment.currency && payment.currency !== "INR") {
    return {
      eventStatus: "failed",
      note: `unsupported currency ${payment.currency}`,
    };
  }

  if (!payment.captured) {
    // Not actually captured yet — leave the order alone; verification requires
    // a captured payment (see ordering-flow.md §2). Acknowledge so Razorpay
    // does not retry until a capture event arrives.
    return {
      eventStatus: "ignored",
      note: `payment ${payment.id} is not captured (status ${payment.status})`,
    };
  }

  if (order.paymentStatus === "paid") {
    if (order.paymentRef === payment.id) {
      return { eventStatus: "processed", note: "already reconciled" };
    }
    return {
      eventStatus: "ignored",
      note: `order ${order.id} already paid by a different payment (${order.paymentRef ?? "unknown"})`,
    };
  }

  if (order.status === "cancelled") {
    return {
      eventStatus: "failed",
      note: `payment captured after cancellation of order ${order.id}; manual refund/reinstatement decision required`,
    };
  }

  // Winner settlement, single transaction: mark paid, move pending→confirmed,
  // and consume stock exactly once. The conditional update decides the winner
  // (whichever writer — webhook, browser verification, or the sweeper — gets
  // here first); the stock ledger claim is INSIDE this transaction, so either
  // both the payment state and the stock move, or neither does.
  const outcome = await settleCapturedPaymentOnOrder({
    orderId: order.id,
    paymentRef: payment.id,
    previousStatus: order.status,
    historyNote: `Razorpay webhook: payment captured (${payment.id})`,
  });

  if (!outcome.won) {
    // Another writer won between our read and our write.
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    if (fresh.paymentRef === payment.id) {
      return { eventStatus: "processed", note: "already reconciled" };
    }
    if (fresh.paymentStatus === "paid") {
      return {
        eventStatus: "ignored",
        note: `order ${order.id} already paid by a different payment (${fresh.paymentRef ?? "unknown"})`,
      };
    }
    return { eventStatus: "ignored", note: "order changed concurrently; re-check manually" };
  }

  return {
    eventStatus: "processed",
    note:
      outcome.stockNote ??
      (outcome.statusUpdated
        ? `order ${order.id} confirmed and marked paid (stock applied)`
        : `order ${order.id} marked paid (stock applied)`),
  };
}

/**
 * Moves an order to paid/confirmed and writes the one-shot stock deduction for
 * the captured razorpay payment. Shared by the webhook dispatcher, the browser
 * verify-payment callback, and the reconciliation sweeper so all three paths
 * converge with the same guarantees:
 *  - the conditional `paymentStatus != paid` update decides the single winner;
 *  - the stock ledger claim (`deduct:pay:{paymentId}`) lives in the same
 *    transaction, so crash/retry can't double-decrement;
 *  - a captured payment with insufficient stock still honours the money state
 *    (paid+confirmed) and records a manual-reconciliation alert instead of
 *    failing the write.
 */
export async function settleCapturedPaymentOnOrder(params: {
  orderId: number;
  paymentRef: string;
  previousStatus: string;
  historyNote: string;
}): Promise<{ won: boolean; statusUpdated: boolean; stockNote: string | null }> {
  return prisma.$transaction(async (tx) => {
    // Conditional update: whichever writer moves the order off "paid"-able
    // state first wins; the others see count 0 and re-read final state.
    const amountMarked = await tx.order.updateMany({
      where: { id: params.orderId, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "paid", paymentRef: params.paymentRef },
    });
    if (amountMarked.count === 0) {
      return { won: false, statusUpdated: false, stockNote: null };
    }

    let statusUpdated = false;
    if (params.previousStatus === "pending") {
      const statusMove = await tx.order.updateMany({
        where: { id: params.orderId, status: "pending" },
        data: { status: "confirmed" },
      });
      if (statusMove.count > 0) {
        statusUpdated = true;
        await tx.orderStatusHistory.create({
          data: {
            orderId: params.orderId,
            status: "confirmed",
            note: params.historyNote,
          },
        });
      }
    }

    // Consume stock exactly once, for the first successful capture of this
    // order. Orders without items (test fixtures) skip the deduction.
    const items = await tx.orderItem.findMany({
      where: { orderId: params.orderId },
      select: { productId: true, quantity: true },
    });

    let stockNote: string | null = null;
    if (items.length > 0) {
      const claimed = await claimStockEvent(
        tx,
        captureDeductionEventId(params.paymentRef),
        `razorpay capture ${params.paymentRef} → order #${params.orderId}`
      );
      if (claimed) {
        try {
          await deductStockWithinTx(tx, items, "razorpay capture");
        } catch (error) {
          if (error instanceof InsufficientStockError) {
            // Money is captured, so the payment state must stand. Alert instead
            // of failing — admin reconciles stock/refund manually.
            stockNote = `payment captured but stock insufficient for product #${error.details.productId} "${error.details.productName}" (need ${error.details.requested}, have ${error.details.available}); manual stock/refund reconciliation required`;
            await tx.orderStatusHistory.create({
              data: { orderId: params.orderId, status: "confirmed", note: stockNote },
            });
          } else {
            throw error;
          }
        }
      }
    }

    return { won: true, statusUpdated, stockNote };
  });
}

async function markEvent(
  eventId: string,
  eventStatus: "processed" | "ignored" | "failed",
  note: string
): Promise<void> {
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: "razorpay", eventId } },
    data: { status: eventStatus, note: note.slice(0, 2000), processedAt: new Date() },
  });
}

/**
 * Full webhook intake: verify → claim → dispatch → record.
 * Throws ApiError(400) for signature/shape problems (Razorpay retries those),
 * ApiError(503) when the webhook secret is not configured.
 */
export async function processRazorpayWebhook(
  rawBody: Buffer,
  signatureHeader: unknown,
  eventIdHeader: unknown
): Promise<{ acknowledged: boolean; replay: boolean; note: string }> {
  if (!isWebhookVerificationEnabled()) {
    throw new ApiError(
      503,
      "Webhook processing is not configured for this environment."
    );
  }

  if (!verifyWebhookSignature(rawBody, signatureHeader)) {
    throw new ApiError(400, "Webhook signature verification failed.");
  }

  const eventId =
    typeof eventIdHeader === "string" ? eventIdHeader.trim() : "";
  if (!eventId || eventId.length > MAX_EVENT_ID_LENGTH) {
    throw new ApiError(400, "Webhook event id is missing or malformed.");
  }

  let body: WebhookEventPayload;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as WebhookEventPayload;
  } catch {
    throw new ApiError(400, "Webhook payload is not valid JSON.");
  }

  const eventType = typeof body.event === "string" ? body.event : "";
  if (!eventType || eventType.length > 64) {
    throw new ApiError(400, "Webhook event type is missing or malformed.");
  }

  const claimed = await claimWebhookEvent(eventId, eventType);
  if (!claimed) {
    return { acknowledged: true, replay: true, note: "event already processed" };
  }

  try {
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const entity =
        eventType === "payment.captured"
          ? body.payload?.payment?.entity
          : body.payload?.payment?.entity ??
            (body.payload?.order?.entity?.id
              ? ({ order_id: body.payload.order.entity.id } as WebhookPaymentEntity)
              : undefined);

      const payment = entity ? normaliseRazorpayPayment(entity) : null;

      let outcome: { eventStatus: string; note: string };
      if (!payment) {
        // For order.paid without a payment entity, ask Razorpay which payment
        // captured this order. We can only trust a payment that the provider
        // itself reports as captured.
        if (eventType === "order.paid" && body.payload?.order?.entity?.id) {
          const fetched = await capturedPaymentLookup(body.payload.order.entity.id);
          outcome = fetched
            ? await applyCapturedRazorpayPayment(body.payload.order.entity.id, fetched)
            : { eventStatus: "ignored", note: "order.paid without a captured payment" };
        } else {
          outcome = { eventStatus: "ignored", note: "event carries no usable payment entity" };
        }
      } else if (eventType === "order.paid" && !payment.captured) {
        // order.paid sometimes carries the payment entity pre-capture; use the
        // provider as the source of truth instead.
        const fetched = await capturedPaymentLookup(payment.orderId);
        outcome = fetched
          ? await applyCapturedRazorpayPayment(payment.orderId, fetched)
          : await applyCapturedRazorpayPayment(payment.orderId, payment);
      } else {
        outcome = await applyCapturedRazorpayPayment(payment.orderId, payment);
      }

      await markEvent(
        eventId,
        markEventStatus(outcome.eventStatus),
        outcome.note
      );
      return { acknowledged: true, replay: false, note: outcome.note };
    }

    if (eventType === "payment.failed") {
      const entity = body.payload?.payment?.entity;
      const description = entity?.error_description ?? entity?.error_reason ?? "";
      const orderId = entity?.order_id ?? "unknown-order";
      await markEvent(
        eventId,
        "processed",
        `payment failed for ${orderId}: ${description}`.slice(0, 2000)
      );
      return {
        acknowledged: true,
        replay: false,
        note: "payment failure recorded; order stays pending and retryable",
      };
    }

    // Recorded and acknowledged without action — keeps the log complete.
    await markEvent(eventId, "ignored", `event type not handled: ${eventType}`);
    return { acknowledged: true, replay: false, note: "event type not handled" };
  } catch (error) {
    // The event is claimed; mark it failed so operations can re-run it later.
    await markEvent(
      eventId,
      "failed",
      `processing error: ${error instanceof Error ? error.message : "unknown"}`.slice(0, 2000)
    );
    // Acknowledge: a retry would be a redelivery (idempotent), but failing
    // loudly here keeps provider retry storms away from a broken handler.
    throw error instanceof ApiError
      ? error
      : new ApiError(500, "Webhook processing failed.");
  }
}

function markEventStatus(
  status: string
): "processed" | "ignored" | "failed" {
  if (status === "processed" || status === "failed") return status;
  return "ignored";
}

export type CapturedPaymentLookup = (
  razorpayOrderId: string
) => Promise<{ id: string; amountPaise: number; currency: string; captured: boolean } | null>;

/**
 * Production lookup: Razorpay REST (orders.fetchPayments), taking only
 * provider-reported captured payments. Tests override this seam to exercise
 * reconciliation without network access.
 */
let capturedPaymentLookup: CapturedPaymentLookup = findCapturedPaymentForOrder;

/** Test seam: swap the provider lookup (call with the original to restore). */
export function overrideCapturedPaymentLookup(lookup: CapturedPaymentLookup): void {
  capturedPaymentLookup = lookup;
}

/** Provider lookups for reconciliation (sweeper + order.paid without entity). */
async function findCapturedPaymentForOrder(
  razorpayOrderId: string
): Promise<{ id: string; amountPaise: number; currency: string; captured: boolean } | null> {  const client = getRazorpayClient();
  if (!client) return null;

  try {
    const payments = (await client.orders.fetchPayments(razorpayOrderId)) as unknown as {
      items?: Array<{
        id: string;
        amount: number | string;
        currency: string;
        status: string;
        captured?: boolean;
      }>;
    };
    const items = payments.items ?? [];
    for (const item of items) {
      if (item.status === "captured") {
        return {
          id: item.id,
          amountPaise: Number(item.amount),
          currency: item.currency,
          captured: true,
        };
      }
    }
    return null;
  } catch (error) {
    console.error(
      "[reconcile] payment lookup failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export type ReconcileSummary = {
  scanned: number;
  confirmed: number;
  skipped: number;
};

/**
 * Sweeps Razorpay orders that are still pending locally and asks the provider
 * whether any payment got captured there — i.e. the reconciliation path for
 * events we missed (webhook misconfigured, server down, safety net) plus
 * browser callbacks that never arrived.
 *
 * The sweep pages through the pending set with a composite
 * (updated_at, id) cursor: a backlog of old rows the provider still calls
 * unpaid can be long, and a fixed per-tick slice must not starve newer
 * pendings forever. Batches are drained until none remain (bounded by
 * maxBatches) — each batch is one provider lookup per row, confirmed rows drop
 * out of the pending filter, skipped rows are paged past.
 */
export async function reconcilePendingRazorpayOrders(options?: {
  olderThanMinutes?: number;
  limit?: number;
  maxBatches?: number;
}): Promise<ReconcileSummary> {
  const olderThanMinutes = Math.max(1, options?.olderThanMinutes ?? 10);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const maxBatches = Math.min(50, Math.max(1, options?.maxBatches ?? 10));

  const summary: ReconcileSummary = { scanned: 0, confirmed: 0, skipped: 0 };

  // (updated_at, id) pagination cursor: rows grow monotonically per batch.
  // The cursor Date is passed straight back as a parameter so the driver's
  // timezone serialization round-trips identically.
  let cursorUpdatedAt: Date | null = null;
  let cursorId = 0;

  type PendingRazorpayRow = {
    id: number | bigint;
    razorpay_order_id: string;
    updated_at: Date;
  };

  for (let batch = 0; batch < maxBatches; batch += 1) {
    // The cutoff stays inside MySQL (DATE_SUB(NOW(0))) so the sweep never
    // depends on how the driver serialises JS Dates versus the session
    // timezone.
    let rows: PendingRazorpayRow[];
    if (cursorUpdatedAt === null) {
      rows = await prisma.$queryRaw<PendingRazorpayRow[]>(Prisma.sql`
        SELECT id, razorpay_order_id, updated_at
        FROM orders
        WHERE payment_method = 'razorpay'
          AND razorpay_order_id IS NOT NULL
          AND payment_status = 'pending'
          AND status <> 'cancelled'
          AND updated_at < DATE_SUB(NOW(0), INTERVAL ${olderThanMinutes} MINUTE)
        ORDER BY updated_at ASC, id ASC
        LIMIT ${limit}`);
    } else {
      rows = await prisma.$queryRaw<PendingRazorpayRow[]>(Prisma.sql`
        SELECT id, razorpay_order_id, updated_at
        FROM orders
        WHERE payment_method = 'razorpay'
          AND razorpay_order_id IS NOT NULL
          AND payment_status = 'pending'
          AND status <> 'cancelled'
          AND updated_at < DATE_SUB(NOW(0), INTERVAL ${olderThanMinutes} MINUTE)
          AND (updated_at > ${cursorUpdatedAt}
               OR (updated_at = ${cursorUpdatedAt} AND id > ${cursorId}))
        ORDER BY updated_at ASC, id ASC
        LIMIT ${limit}`);
    }

    if (rows.length === 0) break;

    const last: PendingRazorpayRow = rows[rows.length - 1];
    cursorUpdatedAt = new Date(last.updated_at);
    cursorId = Number(last.id);

    for (const row of rows) {
      summary.scanned += 1;
      const orderId = Number(row.id);
      const razorpayOrderId = row.razorpay_order_id;
      if (!razorpayOrderId) {
        summary.skipped += 1;
        continue;
      }

      const payment = await capturedPaymentLookup(razorpayOrderId);
      if (!payment) {
        summary.skipped += 1;
        continue;
      }

      const outcome = await applyCapturedRazorpayPayment(razorpayOrderId, payment);
      if (outcome.eventStatus === "processed") summary.confirmed += 1;
      else summary.skipped += 1;

      console.log(
        `[reconcile] order ${orderId} ${razorpayOrderId}: ${outcome.eventStatus} — ${outcome.note}`
      );
    }
  }

  return summary;
}
