import type { Product } from "../generated/client/client.js";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { categorySchema } from "../schemas/product.schema.js";

/** Where uploaded files are served from (see app.ts). */
export const UPLOAD_PUBLIC_PATH = "/uploads/products";

const decimalString = z
  .union([z.string(), z.number(), z.null()])
  .transform((value, ctx) => {
    if (value === null) return null;
    const raw = String(value).trim().replace(/^₹/, "");
    if (raw === "") return null;
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "Enter a price in rupees with up to 2 decimals." });
      return z.NEVER;
    }
    return Number(raw).toFixed(2);
  });

const integerString = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const raw = String(value).trim();
    if (!/^\d{1,7}$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number of 0 or more." });
      return z.NEVER;
    }
    return Number(raw);
  });

/** Product fields accepted from the admin UI (all validated server-side). */
export const adminProductInputSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name.").max(200, "Name is too long."),
  category: categorySchema,
  description: z
    .string()
    .trim()
    .min(1, "Add a short description.")
    .max(2000, "Description is too long."),
  price: decimalString,
  image: z.string().trim().max(500).nullable().optional(),
  available: z.boolean(),
  stockQuantity: integerString,
  lowStockThreshold: integerString,
});

export const adminProductPatchSchema = adminProductInputSchema.partial();

export type AdminProductInput = z.infer<typeof adminProductInputSchema>;

const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  availability: z.enum(["active", "inactive", "low_stock", "out_of_stock"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminProductListQuery = z.infer<typeof productListQuerySchema>;

export type PublicAdminProduct = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: string | null;
  price: string | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  hasOrders: boolean;
};

/**
 * Resolves a stored image value to a browser URL.
 * Accepts a full URL, a root-relative path, or a bare filename (stored directly in
 * `products.image` by an upload handler) — so either storage convention works.
 */
export function resolveProductImage(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `${UPLOAD_PUBLIC_PATH}/${trimmed.replace(/^\/+/, "")}`;
}

type HasOrders = boolean;

export function toAdminProduct(product: Product, hasOrders: HasOrders): PublicAdminProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    image: resolveProductImage(product.image),
    price: product.price ? product.price.toFixed(2) : null,
    available: product.available,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
    archivedAt: product.archivedAt ? product.archivedAt.toISOString() : null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    hasOrders,
  };
}

async function withOrderFlags(products: Product[]): Promise<PublicAdminProduct[]> {
  if (products.length === 0) return [];
  const referenced = await prisma.orderItem.findMany({
    where: { productId: { in: products.map((product) => product.id) } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const referencedIds = new Set(referenced.map((row) => row.productId));
  return products.map((product) => toAdminProduct(product, referencedIds.has(product.id)));
}

export async function listAdminProducts(rawQuery: unknown) {
  const query = productListQuerySchema.parse(rawQuery);
  const where: Record<string, unknown> = {};

  if (query.q) {
    where.OR = [
      { name: { contains: query.q } },
      { description: { contains: query.q } },
      ...(/^\d+$/.test(query.q) ? [{ id: Number(query.q) }] : []),
    ];
  }
  if (query.category) where.category = query.category;

  switch (query.availability) {
    case "active":
      where.archivedAt = null;
      where.available = true;
      break;
    case "inactive":
      where.available = false;
      break;
    case "low_stock":
      where.archivedAt = null;
      where.stockQuantity = { gt: 0 };
      where.available = true;
      // MySQL cannot compare two columns through Prisma's typed filters.
      where.AND = [{ stockQuantity: { lte: prisma.product.fields.lowStockThreshold } }];
      break;
    case "out_of_stock":
      where.stockQuantity = { lte: 0 };
      break;
    default:
      break;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ archivedAt: "asc" }, { category: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: await withOrderFlags(products),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function getAdminProduct(id: number): Promise<PublicAdminProduct> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Product not found.");
  const [withFlags] = await withOrderFlags([product]);
  return withFlags;
}

export async function createAdminProduct(input: AdminProductInput): Promise<PublicAdminProduct> {
  const product = await prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      description: input.description,
      price: input.price,
      image: input.image ?? null,
      available: input.available,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
    },
  });
  return toAdminProduct(product, false);
}

export async function updateAdminProduct(
  id: number,
  input: Partial<AdminProductInput>
): Promise<PublicAdminProduct> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Product not found.");

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.category === undefined ? {} : { category: input.category }),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.price === undefined ? {} : { price: input.price }),
      ...(input.image === undefined ? {} : { image: input.image }),
      ...(input.available === undefined ? {} : { available: input.available }),
      ...(input.stockQuantity === undefined ? {} : { stockQuantity: input.stockQuantity }),
      ...(input.lowStockThreshold === undefined ? {} : { lowStockThreshold: input.lowStockThreshold }),
    },
  });
  return getAdminProduct(product.id);
}

export async function setAdminProductArchived(
  id: number,
  archived: boolean
): Promise<PublicAdminProduct> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Product not found.");

  if (archived && existing.archivedAt) return getAdminProduct(id);
  if (!archived && !existing.archivedAt) return getAdminProduct(id);

  await prisma.product.update({
    where: { id },
    data: {
      archivedAt: archived ? new Date() : null,
      // An archived product is never purchasable; restoring keeps the owner's
      // availability choice (they can re-enable it from the edit form).
      ...(archived ? { available: false } : {}),
    },
  });
  return getAdminProduct(id);
}

/** Only the image column is touched, so concurrent product edits aren't clobbered. */
export async function setAdminProductImage(
  id: number,
  image: string | null
): Promise<PublicAdminProduct> {
  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError(404, "Product not found.");
  await prisma.product.update({ where: { id }, data: { image } });
  return getAdminProduct(id);
}

export async function getAdminProductImageValue(id: number): Promise<string | null> {
  const product = await prisma.product.findUnique({ where: { id }, select: { image: true } });
  return product?.image ?? null;
}
