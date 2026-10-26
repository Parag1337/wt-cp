import type { Order } from "./order-api";

/** What the checkout redirect told us. NEVER proof that payment succeeded. */
export type CheckoutFlag = "success" | "pending" | "retry" | "cancelled" | "placed" | null;

export type FeedbackTone = "success" | "info" | "warning" | "error";

export type OrderFeedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
  /** True when the customer should be offered a "Pay now" button. */
  canRetryPayment: boolean;
};

type OrderLike = Pick<Order, "status" | "payment">;

export function getCheckoutFlag(params: URLSearchParams): CheckoutFlag {
  if (params.get("placed") !== "1") return null;
  const pay = params.get("pay");
  if (pay === "success" || pay === "pending" || pay === "retry" || pay === "cancelled") {
    return pay;
  }
  return "placed";
}

export function canRetryPayment(order: OrderLike): boolean {
  return (
    order.payment?.method === "razorpay" &&
    order.payment.status !== "paid" &&
    order.status !== "cancelled"
  );
}

function amountLabel(order: Pick<Order, "total">): string {
  if (!order.total) return "the order amount";
  return `₹${parseFloat(order.total).toLocaleString("en-IN")}`;
}

/**
 * Turns the redirect flag + authoritative order state into one banner.
 * Query parameters are only hints: "success" is reported as success only when
 * the backend says the payment status is paid.
 */
export function getOrderFeedback(
  order: Order,
  flag: CheckoutFlag
): OrderFeedback | null {
  const method = order.payment?.method ?? "cod";
  const paid = order.payment?.status === "paid";
  const retry = canRetryPayment(order);

  // Backend state wins over any redirect flag: a stale "retry" link must not
  // scare a customer whose payment was in fact confirmed.
  if (paid) {
    return {
      tone: "success",
      title: "Payment received",
      message: `We've confirmed your payment of ${amountLabel(order)}. Your order is confirmed.`,
      canRetryPayment: false,
    };
  }

  if (flag === "success") {
    return {
      tone: "warning",
      title: "Confirming your payment",
      message:
        "Your payment is not confirmed yet. Refresh this order in a moment — no second payment is needed unless we ask you to retry.",
      canRetryPayment: retry,
    };
  }

  if (flag === "retry") {
    return {
      tone: "warning",
      title: "Online payment wasn't completed",
      message: `Your order is saved and nothing has been charged. You can pay ${amountLabel(order)} now or pay on delivery after calling the store.`,
      canRetryPayment: retry,
    };
  }

  if (flag === "cancelled") {
    return {
      tone: "info",
      title: "Payment cancelled",
      message: "Nothing was charged. Your order is saved and you can pay for it whenever you're ready.",
      canRetryPayment: retry,
    };
  }

  if (flag === "pending") {
    if (method === "razorpay") {
      return {
        tone: "warning",
        title: "Payment not completed",
        message: "The payment window closed before the payment was confirmed. Your order is saved.",
        canRetryPayment: retry,
      };
    }
    if (method === "upi") {
      return {
        tone: "info",
        title: "Order placed — UPI payment pending",
        message:
          "We've saved your UPI transaction reference. The store will verify it before dispatch — this is not proof of payment yet.",
        canRetryPayment: false,
      };
    }
    return {
      tone: "info",
      title: "Order placed — pay on delivery",
      message: `Nothing has been paid yet. Pay ${amountLabel(order)} in cash or UPI when your order is delivered.`,
      canRetryPayment: false,
    };
  }

  if (flag === "placed") {
    if (method === "cod") {
      return {
        tone: "info",
        title: "Order placed successfully",
        message: `Nothing has been paid yet. Pay ${amountLabel(order)} in cash or UPI when your order is delivered.`,
        canRetryPayment: false,
      };
    }
    if (method === "upi") {
      return {
        tone: "info",
        title: "Order placed — UPI payment pending",
        message:
          "We've saved your UPI transaction reference. The store will confirm it before dispatch.",
        canRetryPayment: false,
      };
    }
    return {
      tone: "warning",
      title: "Order placed — payment pending",
      message: `We haven't received your payment of ${amountLabel(order)} yet. You can pay now or contact the store.`,
      canRetryPayment: retry,
    };
  }

  // No redirect flag (direct visit or refresh): still explain an unpaid online order.
  if (retry) {
    return {
      tone: "info",
      title: "Payment pending",
      message: `This order is waiting for ${amountLabel(order)}. You can complete the payment now.`,
      canRetryPayment: true,
    };
  }

  return null;
}

export const PAYMENT_STATUS_TEXT: Record<string, string> = {
  paid: "Paid",
  pending: "Awaiting payment",
  cod_due: "Pay on delivery",
  failed: "Payment failed",
  refunded: "Refunded",
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_TEXT[status] ?? status.replace(/_/g, " ");
}
