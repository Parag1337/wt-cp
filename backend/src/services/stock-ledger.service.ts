import { Prisma, PrismaClient } from "../generated/client/client.js";

/**
 * Durable one-shot stock ledger.
 *
 * Design (docs/ordering-flow.md §4 — "Stock on order"):
 * - COD/UPI orders consume stock atomically at placement: the decrement is a
 *   conditional `UPDATE ... WHERE stock_quantity >= qty` inside the SAME
 *   transaction that inserts the order, so an overselling placement rolls back
 *   completely (no order row, no ledger claim).
 * - Razorpay orders consume stock exactly once at payment success, whichever
 *   writer gets there first (browser verify-payment, captured webhook, or the
 *   reconciliation sweeper). The winner is decided by a conditional update
 *   (`paymentStatus: { not: "paid" }`), so only one writer reaches the
 *   decrement; the ledger claim fences even a buggy double-win.
 * - A failed payment never writes stock: the deduction is coupled to the
 *   paymentStatus moving to "paid", not to order existence.
 * - Re-deliveries/retries/crash-recoveries can't double-decrement: every stock
 *   write is fenced by a claim row in `webhook_events` (unique
 *   (provider, event_id) index from migration 20261027000000). The claim is
 *   part of the same transaction as the decrement, so either both happen or
 *   neither does.
 * - Admin cancellation restores stock for orders that consumed it (see
 *   admin-order.service.ts), also fenced by a one-shot claim (restore:*).
 *
 * The ledger reuses the `webhook_events` table with a dedicated provider value,
 * so no extra schema is needed. Event id namespaces:
 *   deduct:order:{orderId}        — COD/UPI placement deduction
 *   deduct:pay:{razorpayPaymentId} — razorpay capture deduction
 *   restore:order:{orderId}       — cancellation restore
 */

export const STOCK_LEDGER_PROVIDER = "stock-ledger";

/** Any Prisma transaction client or a bare PrismaClient instance. */
export type StockDbClient = Prisma.TransactionClient | PrismaClient;

export type StockLedgerItem = { productId: number; quantity: number };

export function placementDeductionEventId(orderId: number): string {
  return `deduct:order:${orderId}`;
}

export function captureDeductionEventId(razorpayPaymentId: string): string {
  return `deduct:pay:${razorpayPaymentId}`;
}

export function restoreEventId(orderId: number): string {
  return `restore:order:${orderId}`;
}

async function ledgerRowExists(
  client: StockDbClient,
  eventId: string
): Promise<boolean> {
  const row = await client.webhookEvent.findUnique({
    where: {
      provider_eventId: { provider: STOCK_LEDGER_PROVIDER, eventId },
    },
    select: { id: true },
  });
  return !!row;
}

/** Has this order already consumed stock via a placement-time deduction? */
export function hasPlacementDeduction(client: StockDbClient, orderId: number): Promise<boolean> {
  return ledgerRowExists(client, placementDeductionEventId(orderId));
}

/** Has this razorpay payment already consumed stock via a capture deduction? */
export function hasCaptureDeduction(
  client: StockDbClient,
  razorpayPaymentId: string
): Promise<boolean> {
  return ledgerRowExists(client, captureDeductionEventId(razorpayPaymentId));
}

/** Has this order already had a cancellation restore? */
export function hasRestore(client: StockDbClient, orderId: number): Promise<boolean> {
  return ledgerRowExists(client, restoreEventId(orderId));
}

/**
 * Claims a one-shot ledger row. Returns true (this transaction performs the
 * paired stock write) or false (another writer already did the paired write).
 * P2002 on the unique (provider, event_id) index means the claim lost.
 */
export async function claimStockEvent(
  client: Prisma.TransactionClient,
  eventId: string,
  note: string
): Promise<boolean> {
  try {
    await client.webhookEvent.create({
      data: {
        provider: STOCK_LEDGER_PROVIDER,
        eventId,
        eventType: "stock.write",
        status: "processed",
        note: note.slice(0, 2000),
        processedAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

export class InsufficientStockError extends Error {
  readonly details: { productId: number; productName: string; requested: number; available: number };

  constructor(details: {
    productId: number;
    productName: string;
    requested: number;
    available: number;
  }) {
    super(
      `Insufficient stock for "${details.productName}": need ${details.requested}, ${details.available} available.`
    );
    this.name = "InsufficientStockError";
    this.details = details;
  }
}

/** Product-level aggregation: repeated rows for one product are summed. */
export function aggregateItems(items: StockLedgerItem[]): Array<{ productId: number; quantity: number }> {
  const byProduct = new Map<number, number>();
  for (const item of items) {
    if (item.quantity > 0) {
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Conditional per-product decrement inside the caller's transaction. Throws
 * InsufficientStockError (rolling the transaction back) on the first product
 * whose available stock has dropped below the requested amount — protecting
 * against overselling under concurrency.
 */
export async function deductStockWithinTx(
  client: Prisma.TransactionClient,
  items: StockLedgerItem[],
  auditNote: string
): Promise<void> {
  const aggregated = aggregateItems(items);
  if (aggregated.length === 0) return;

  for (const { productId, quantity } of aggregated) {
    const updated = await client.$executeRaw(
      Prisma.sql`UPDATE products
                 SET stock_quantity = stock_quantity - ${quantity}, updated_at = NOW()
                 WHERE id = ${productId} AND stock_quantity >= ${quantity} AND archived_at IS NULL`
    );
    if (updated === 0) {
      const rows = (await client.$queryRaw(
        Prisma.sql`SELECT id, name, stock_quantity FROM products WHERE id = ${productId} LIMIT 1`
      )) as Array<{ id: number; name: string; stock_quantity: number }>;
      const product = rows[0];
      void auditNote; // the actor note lives on the paired ledger claim row
      throw new InsufficientStockError({
        productId,
        productName: product?.name ?? `#${productId}`,
        requested: quantity,
        available: product?.stock_quantity ?? 0,
      });
    }
  }
  void auditNote;
}

/**
 * Stock restore for cancellations (caller's transaction). The caller is
 * responsible for ensuring the order previously consumed stock; the one-shot
 * restore claim is owned by admin-order.service.ts.
 */
export async function restoreStockWithinTx(
  client: Prisma.TransactionClient,
  items: StockLedgerItem[],
  auditNote: string
): Promise<number> {
  let restored = 0;
  for (const { productId, quantity } of aggregateItems(items)) {
    // Restores ignore archived/available state: stock truth is stock.
    const updated = await client.$executeRaw(
      Prisma.sql`UPDATE products
                 SET stock_quantity = stock_quantity + ${quantity}, updated_at = NOW()
                 WHERE id = ${productId}`
    );
    if (updated > 0) restored += quantity;
  }
  void auditNote; // carried by the paired ledger claim row
  return restored;
}
