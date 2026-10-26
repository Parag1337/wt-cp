"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "../../lib/cart-context";
import { useAuth } from "../../lib/auth-context";
import { addressApi, type SavedAddress } from "../../lib/address-api";
import { orderApi, type Order, type RazorpayOrder } from "../../lib/order-api";
import { openRazorpayCheckout } from "../../lib/razorpay-checkout";
import { PAYMENT_METHODS, type PaymentMethod } from "../../lib/payment";
import { ProductImage } from "../../components/ui/product-image";
import { Button } from "../../components/button";
import { EmptyState } from "../../components/ui/empty-state";
import { ListRowsSkeleton } from "../../components/ui/skeleton";
import { ShoppingCart } from "@phosphor-icons/react";

const inputCls =
  "w-full rounded-xl border border-forest-800/20 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-forest-400 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20";

const labelCls = "mb-1.5 block text-sm font-semibold text-forest-800";

const IDEMPOTENCY_KEY_STORAGE = "jh_checkout_idem_key";

/**
 * One idempotency key per browser checkout session. Reused across retries of
 * the same submission (network drop, refresh, double tab) so the server never
 * creates the order twice; cleared once the order was accepted so a later,
 * genuinely new checkout starts a fresh key.
 */
function getCheckoutIdempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(IDEMPOTENCY_KEY_STORAGE);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
            .toString(36)
            .slice(2)}`;
    sessionStorage.setItem(IDEMPOTENCY_KEY_STORAGE, fresh);
    return fresh;
  } catch {
    // Storage can be unavailable (private mode); fall through without a key —
    // the process-local server guard and cart clearing still apply.
    return "";
  }
}

function clearCheckoutIdempotencyKey(): void {
  try {
    sessionStorage.removeItem(IDEMPOTENCY_KEY_STORAGE);
  } catch {
    // ignore
  }
}

export default function CheckoutContent() {
  const router = useRouter();
  const { cart, status, refresh } = useCart();
  const { status: authStatus } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [pincode, setPincode] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    addressApi
      .list()
      .then((data) => {
        const list = data.addresses ?? [];
        setSavedAddresses(list);
        const def = list.find((a) => a.isDefault) ?? list[0];
        if (def) {
          setSelectedAddressId(def.id);
          setFullName(def.fullName);
          setPhone(def.phone);
          setAddressLine1(def.addressLine1);
          setAddressLine2(def.addressLine2 ?? "");
          setCity(def.city);
          setState(def.state);
          setPincode(def.pincode);
        }
      })
      .catch(() => {});
  }, [authStatus]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  // Guards against double-clicks creating two orders before React re-renders.
  const submittingRef = useRef(false);

  if (authStatus === "loading" || status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading checkout</span>
        <ListRowsSkeleton rows={4} />
      </div>
    );
  }

  if (authStatus !== "authenticated") {
    return (
      <EmptyState
        icon={<ShoppingCart size={30} weight="fill" aria-hidden="true" />}
        title="Please log in to check out"
        description="You need an account to place an order."
      >
        <Link href="/login?redirect=/checkout">
          <Button size="lg">Log In</Button>
        </Link>
      </EmptyState>
    );
  }

  if (cart.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart size={30} weight="fill" aria-hidden="true" />}
        title="Your cart is empty"
        description="Add some products before checking out."
      >
        <Link href="/shop/products">
          <Button size="lg">Browse Products</Button>
        </Link>
      </EmptyState>
    );
  }

  const subtotal = cart.subtotal ? parseFloat(cart.subtotal) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (submittingRef.current) return;

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    if (paymentMethod === "upi" && !/^\d{12}$/.test(paymentRef.trim())) {
      setError("Enter the 12-digit UPI transaction reference.");
      return;
    }

    submittingRef.current = true;
    setPlacing(true);
    try {
      const idempotencyKey = getCheckoutIdempotencyKey() || undefined;
      const data = await orderApi.placeOrder(
        {
          fullName: fullName.trim(),
          phone: phone.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim(),
          city: city.trim(),
          state: state.trim() || "Maharashtra",
          pincode: pincode.trim(),
          paymentMethod,
          paymentRef: paymentRef.trim(),
          addressId: selectedAddressId ?? undefined,
          saveAddress: selectedAddressId === null ? saveAddress : false,
        },
        { idempotencyKey }
      );

      // The order is durable now (created or replayed under this key).
      clearCheckoutIdempotencyKey();

      // The order now exists. Any payment problem below must land the customer
      // on the order page where they can retry — never on a dead end.
      if (paymentMethod === "razorpay" && data.razorpay) {
        await payWithRazorpay(data.order, data.razorpay);
        return;
      }

      await refresh();
      router.push(`/orders/${data.order.id}?placed=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't place your order.");
    } finally {
      submittingRef.current = false;
      setPlacing(false);
    }
  }

  async function payWithRazorpay(order: Order, rp: RazorpayOrder) {
    const result = await openRazorpayCheckout({
      keyId: rp.keyId,
      orderId: rp.orderId,
      amountPaise: rp.amountPaise,
      orderNumber: order.id,
      customerName: fullName.trim(),
      customerPhone: phone.trim(),
    });

    await refresh();

    if (result.status === "success") {
      try {
        await orderApi.verifyPayment(order.id, {
          razorpayPaymentId: result.paymentId,
          razorpaySignature: result.signature,
        });
        router.push(`/orders/${order.id}?placed=1&pay=success`);
      } catch (err) {
        // Order exists; the detail page re-reads the real payment state and
        // offers a retry instead of pretending the payment succeeded.
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't confirm your payment yet."
        );
        router.push(`/orders/${order.id}?placed=1&pay=retry`);
      }
      return;
    }

    router.push(
      `/orders/${order.id}?placed=1&pay=${
        result.status === "dismissed" ? "pending" : "retry"
      }`
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* Address */}
        <div className="rounded-2xl border border-forest-800/10 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-ink">Delivery Address</h2>
          {savedAddresses.length > 0 && (
            <div className="mb-5">
              <label htmlFor="co-saved-address" className={labelCls}>Saved address</label>
              <select
                id="co-saved-address"
                value={selectedAddressId ?? ""}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  setSelectedAddressId(id);
                  if (id === null) {
                    setFullName("");
                    setPhone("");
                    setAddressLine1("");
                    setAddressLine2("");
                    setCity("");
                    setState("Maharashtra");
                    setPincode("");
                    return;
                  }
                  const a = savedAddresses.find((x) => x.id === id);
                  if (a) {
                    setFullName(a.fullName);
                    setPhone(a.phone);
                    setAddressLine1(a.addressLine1);
                    setAddressLine2(a.addressLine2 ?? "");
                    setCity(a.city);
                    setState(a.state);
                    setPincode(a.pincode);
                  }
                }}
                className={inputCls}
              >
                <option value="">Enter a new address</option>
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.label || "Address") + " — " + a.fullName + ", " + a.city}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedAddressId === null && (
            <label className="mb-5 flex items-center gap-2 text-sm text-forest-800">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
              />
              Save this address to my profile
            </label>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="co-name" className={labelCls}>Full name</label>
              <input id="co-name" required minLength={2} maxLength={120} value={fullName}
                onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Parag Patil"
                className={inputCls} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="co-phone" className={labelCls}>Mobile number</label>
              <input id="co-phone" required inputMode="numeric" pattern="[6-9][0-9]{9}"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile" className={inputCls} autoComplete="tel" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-addr1" className={labelCls}>Street address</label>
              <input id="co-addr1" required minLength={5} value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="House no, street, landmark" className={inputCls}
                autoComplete="street-address" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="co-addr2" className={labelCls}>
                Address line 2 <span className="font-normal text-forest-500">(optional)</span>
              </label>
              <input id="co-addr2" value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Village / area" className={inputCls} />
            </div>
            <div>
              <label htmlFor="co-city" className={labelCls}>City</label>
              <input id="co-city" required value={city}
                onChange={(e) => setCity(e.target.value)} placeholder="e.g. Khamgaon"
                className={inputCls} autoComplete="address-level2" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="co-state" className={labelCls}>State</label>
                <input id="co-state" required value={state}
                  onChange={(e) => setState(e.target.value)} className={inputCls}
                  autoComplete="address-level1" />
              </div>
              <div>
                <label htmlFor="co-pin" className={labelCls}>Pincode</label>
                <input id="co-pin" required inputMode="numeric" pattern="[0-9]{6}"
                  value={pincode} onChange={(e) => setPincode(e.target.value)}
                  placeholder="444303" className={inputCls} autoComplete="postal-code" />
              </div>
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-2xl border border-forest-800/10 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-ink">Payment Method</h2>
          <div className="mt-4 space-y-3" role="radiogroup" aria-label="Payment method">
            {PAYMENT_METHODS.map((m) => (
              <label
                key={m.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                  m.disabled
                    ? "cursor-not-allowed opacity-50"
                    : paymentMethod === m.value
                      ? "border-forest-700 bg-forest-50/50"
                      : "border-forest-800/15 hover:border-forest-800/40"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m.value}
                  disabled={m.disabled}
                  checked={paymentMethod === m.value}
                  onChange={() => setPaymentMethod(m.value)}
                  className="mt-1 accent-green-900"
                />
                <span>
                  <span className="block text-sm font-bold text-ink">{m.label}</span>
                  <span className="mt-0.5 block text-sm text-forest-700">{m.description}</span>
                </span>
              </label>
            ))}
          </div>

          {paymentMethod === "upi" && (
            <div className="mt-4 rounded-xl bg-cream-50 p-4">
              <p className="text-sm text-forest-800">
                Pay to our store UPI ID, then paste the 12-digit transaction
                reference below. Your order stays payment-pending until the
                store verifies the reference — it is not treated as proof of
                payment.
              </p>
              <label htmlFor="co-upi-ref" className={`${labelCls} mt-3`}>
                UPI transaction reference
              </label>
              <input
                id="co-upi-ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]{12}"
                maxLength={12}
                placeholder="e.g. 412345678901"
                className={inputCls}
              />
            </div>
          )}

          {paymentMethod === "cod" && (
            <p className="mt-4 rounded-xl bg-cream-50 p-4 text-sm text-forest-800">
              Pay in cash or UPI when your order is delivered to your address.
            </p>
          )}

          {paymentMethod === "razorpay" && (
            <p className="mt-4 rounded-xl bg-cream-50 p-4 text-sm text-forest-800">
              After placing your order, a secure Razorpay popup opens for card,
              UPI, or netbanking payment. Your order is confirmed once payment succeeds.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="lg:self-start">
        <div className="rounded-2xl border border-forest-800/10 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-ink">Order Summary</h2>
          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <ProductImage src={item.productImage} alt={item.productName}
                  className="size-12 shrink-0 rounded-lg" imageClassName="object-cover" sizes="48px" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{item.productName}</p>
                  <p className="text-xs text-forest-600">Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-semibold text-forest-800">
                  {item.unitPrice
                    ? `₹${(parseFloat(item.unitPrice) * item.quantity).toLocaleString("en-IN")}`
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-forest-800/10 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-forest-700">Items</span>
              <span className="font-semibold text-ink">{cart.totalItems}</span>
            </div>
            <div className="mt-2 flex justify-between text-base">
              <span className="font-semibold text-ink">Total</span>
              <span className="font-bold text-forest-800">
                {subtotal > 0 ? `₹${subtotal.toLocaleString("en-IN")}` : "Price on request"}
              </span>
            </div>
          </div>
          <Button type="submit" disabled={placing} className="mt-6 w-full">
            {placing ? "Placing Order..." : `Place Order${subtotal > 0 ? ` • ₹${subtotal.toLocaleString("en-IN")}` : ""}`}
          </Button>
          <Link href="/cart"
            className="mt-2 flex items-center justify-center px-4 py-2 text-sm font-semibold text-forest-700 underline-offset-4 hover:underline">
            Back to Cart
          </Link>
        </div>
      </div>
    </form>
  );
}
