/**
 * Razorpay Checkout.js integration.
 *
 * Only the public key id ever reaches the browser; the secret stays on the
 * server. The checkout callback is treated as a hint — the server verifies the
 * signature and the payment with Razorpay before an order is marked paid.
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const LOAD_TIMEOUT_MS = 10_000;

export type RazorpayCheckoutResult =
  | { status: "success"; paymentId: string; signature: string }
  | { status: "dismissed" }
  | { status: "failed"; reason: string }
  | { status: "unavailable" };

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loader: Promise<boolean> | null = null;

function hasConstructor(): boolean {
  return typeof window !== "undefined" && typeof window.Razorpay === "function";
}

/**
 * Loads checkout.js once per page. A failed load resets the cache so a retry
 * (after a flaky network, blocked script or ad blocker) can try again.
 */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);
  if (hasConstructor()) return Promise.resolve(true);
  if (loader) return loader;

  const promise = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok && hasConstructor());
    };

    const timer = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );

    if (existing) {
      existing.addEventListener("load", () => finish(true), { once: true });
      existing.addEventListener("error", () => finish(false), { once: true });
      // The tag may have finished before we attached the listeners.
      if (hasConstructor()) finish(true);
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => {
      script.remove();
      finish(false);
    };
    document.body.appendChild(script);
  });

  loader = promise;
  void promise.then((ok) => {
    // Keep a successful loader cached; allow a fresh attempt after a failure.
    if (!ok) loader = null;
  });

  return promise;
}

export type RazorpayCheckoutInput = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  orderNumber: number;
  customerName?: string;
  customerPhone?: string;
};

/**
 * Opens the Razorpay popup and resolves with the outcome.
 * - success: Checkout returned a payment id + signature (still verified server-side)
 * - dismissed: window closed without a completed payment
 * - failed: Razorpay reported a failed payment before the window closed
 * - unavailable: checkout.js could not be loaded (network/ad blocker)
 */
export async function openRazorpayCheckout(
  input: RazorpayCheckoutInput
): Promise<RazorpayCheckoutResult> {
  const loaded = await loadRazorpayCheckout();
  const RazorpayCtor = typeof window !== "undefined" ? window.Razorpay : undefined;

  if (!loaded || !RazorpayCtor) {
    return { status: "unavailable" };
  }

  return new Promise<RazorpayCheckoutResult>((resolve) => {
    let settled = false;
    let lastFailure: string | null = null;
    let instance: RazorpayInstance;

    const settle = (result: RazorpayCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      instance = new RazorpayCtor({
        key: input.keyId,
        amount: input.amountPaise,
        currency: "INR",
        name: "Jay Hari Krushi Seva Kendra",
        description: `Order #${input.orderNumber}`,
        order_id: input.orderId,
        prefill: {
          name: input.customerName ?? "",
          contact: input.customerPhone ?? "",
        },
        theme: { color: "#1a3c2e" },
        handler: (response: unknown) => {
          const payload = response as {
            razorpay_payment_id?: string;
            razorpay_signature?: string;
          } | null;

          if (!payload?.razorpay_payment_id || !payload.razorpay_signature) {
            settle({
              status: "failed",
              reason:
                "The payment provider didn't return a payment reference. Your order is still pending.",
            });
            return;
          }

          settle({
            status: "success",
            paymentId: payload.razorpay_payment_id,
            signature: payload.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => {
            if (lastFailure) {
              settle({ status: "failed", reason: lastFailure });
            } else {
              settle({ status: "dismissed" });
            }
          },
        },
      });

      instance.on("payment.failed", (payload: unknown) => {
        const error = (payload as { error?: { description?: string } } | null)?.error;
        lastFailure =
          error?.description ??
          "The payment failed. Your order is saved and nothing was charged.";
      });

      instance.open();
    } catch {
      settle({
        status: "failed",
        reason: "We couldn't open the payment window. Please try again.",
      });
    }
  });
}
