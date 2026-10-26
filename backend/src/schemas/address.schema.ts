import { z } from "zod";

export const addressSchema = z.object({
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
  landmark: z.string().trim().max(255).optional().default(""),
  label: z.string().trim().max(32).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const addressUpdateSchema = addressSchema.partial();
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;