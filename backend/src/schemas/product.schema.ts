import { z } from "zod";

export const categorySchema = z.enum([
  "Fertilizers",
  "Seeds",
  "Pesticides",
  "Agricultural Products",
]);

export const searchParamsSchema = z.object({
  q: z.string().optional(),
  category: categorySchema.optional(),
});

export type SearchParams = z.infer<typeof searchParamsSchema>;

export const adminProductListSchema = z.object({
  q: z.string().optional(),
  category: categorySchema.optional(),
  available: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  lowStock: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminProductCreateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: categorySchema,
  description: z.string().trim().min(1).max(5000),
  image: z.string().trim().max(500).optional().nullable(),
  price: z.coerce.number().min(0).nullable().optional(),
  available: z.boolean().optional().default(true),
  stockQuantity: z.coerce.number().int().min(0).optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
});

export const adminProductUpdateSchema = adminProductCreateSchema.partial();

export const priceUpdateSchema = z.object({
  price: z.coerce.number().min(0).nullable(),
  available: z.boolean().optional(),
});

export const availabilityUpdateSchema = z.object({
  available: z.boolean(),
});

export const inventoryAdjustSchema = z.object({
  delta: z.coerce.number().int().refine((v) => v !== 0, "Delta cannot be zero."),
  reason: z.string().trim().min(1).max(255).optional().default("manual adjustment"),
});

export const inquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(120, "Name is too long."),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s-]{10,15}$/, "Please enter a valid phone number."),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(255),
  product: z
    .string()
    .trim()
    .optional()
    .nullable(),
  message: z
    .string()
    .trim()
    .min(1, "Please enter a message.")
    .max(2000),
});

export type InquiryInput = z.infer<typeof inquirySchema>;
