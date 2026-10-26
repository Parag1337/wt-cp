import { z } from "zod";

export const orderStatusSchema = z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]);

export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Payment methods supported at checkout.
// "cod" + "upi" are live now; "razorpay" is stubbed and ready to enable
// once RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are configured.
export const paymentMethodSchema = z.enum(["cod", "upi", "razorpay"]);

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const checkoutSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number."),
    addressLine1: z.string().trim().min(5, "Enter your street address.").max(255),
    addressLine2: z.string().trim().max(255).optional().default(""),
    city: z.string().trim().min(2, "Enter your city.").max(100),
    state: z.string().trim().min(2).max(100).default("Maharashtra"),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
    paymentMethod: paymentMethodSchema.default("cod"),
    // UPI transaction reference (12-digit) entered by the customer after paying.
    // Required only when paymentMethod is "upi".
    paymentRef: z.string().trim().max(255).optional().default(""),
  })
  .superRefine((data, ctx) => {
    // A UPI reference is a customer-supplied claim, not proof of payment, so it
    // only has to be the expected shape. The order stays payment-pending until
    // the store reconciles it.
    if (data.paymentMethod === "upi" && !/^\d{12}$/.test(data.paymentRef)) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentRef"],
        message: "Enter the 12-digit UPI transaction reference.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const verifyPaymentSchema = z.object({
  razorpayPaymentId: z.string().min(1, "Missing payment id."),
  razorpaySignature: z.string().min(1, "Missing payment signature."),
});

export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
