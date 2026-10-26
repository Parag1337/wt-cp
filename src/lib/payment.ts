export type PaymentMethod = "cod" | "upi" | "razorpay";

export const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  description: string;
  disabled?: boolean;
}[] = [
  {
    value: "cod",
    label: "Cash on Delivery",
    description: "Pay in cash or UPI when your order arrives.",
  },
  {
    value: "upi",
    label: "UPI",
    description: "Pay to our UPI ID now, then enter the transaction reference.",
  },
  {
    value: "razorpay",
    label: "Card / UPI / Netbanking (Online)",
    description: "Pay securely online via Razorpay.",
  },
];

export function paymentLabel(method: string): string {
  return (
    PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method.toUpperCase()
  );
}
