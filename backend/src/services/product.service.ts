import type { Product } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { searchParamsSchema, type SearchParams } from "../schemas/product.schema.js";

export type PublicProduct = {
  id: number;
  name: string;
  category: string;
  description: string;
  image: string | null;
  price: string | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
};

function toPublicProduct(product: Pick<Product, "id" | "name" | "category" | "description" | "image" | "price" | "available" | "stockQuantity" | "lowStockThreshold">): PublicProduct {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    description: product.description,
    image: product.image,
    price: product.price ? product.price.toString() : null,
    available: product.available,
    stockQuantity: product.stockQuantity,
    lowStockThreshold: product.lowStockThreshold,
  };
}

export async function listProducts(params: SearchParams): Promise<{
  products: PublicProduct[];
  total: number;
  categories: string[];
}> {
  const parsed = searchParamsSchema.safeParse(params);
  const search = parsed.data?.q ?? undefined;
  const category = parsed.data?.category;

  // Archived products stay in the database (order history references them) but are
  // never listed in the storefront.
  const where: Record<string, unknown> = { archivedAt: null };
  if (category) {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      image: true,
      price: true,
      available: true,
      stockQuantity: true,
      lowStockThreshold: true,
    },
      skip: 0,
      take: 100,
    }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { archivedAt: null },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  return {
    products: products.map(toPublicProduct),
    total,
    categories: categories.map((c) => c.category),
  };
}

export async function getProductByIdAdmin(id: number): Promise<PublicProduct | null> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return null;
  return toPublicProduct(product);
}

export async function getProductById(id: number): Promise<PublicProduct | null> {
  return getProductByIdAdmin(id);
}

export async function listProductsAdmin(params: {
  q?: string;
  category?: string;
  available?: boolean;
  lowStock?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ products: PublicProduct[]; total: number; page: number; pageSize: number }> {
  const where: Record<string, unknown> = {};
  if (params.category) where.category = params.category;
  if (params.available !== undefined) where.available = params.available;
  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { description: { contains: params.q } },
    ];
  }
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const [all, totalAll] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ updatedAt: "desc" }] }),
    prisma.product.count({ where }),
  ]);
  const filtered = params.lowStock
    ? all.filter((p) => p.stockQuantity <= p.lowStockThreshold)
    : all;
  const total = params.lowStock ? filtered.length : totalAll;
  const products = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { products: products.map(toPublicProduct), total, page, pageSize };
}

export async function createProductAdmin(input: {
  name: string;
  category: string;
  description: string;
  image?: string | null;
  price?: number | null;
  available?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}): Promise<PublicProduct> {
  if (input.available && (input.price === null || input.price === undefined)) {
    throw new Error("Purchasable products must have a valid price.");
  }
  const product = await prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      description: input.description,
      image: input.image ?? null,
      price: input.price ?? null,
      available: input.available ?? true,
      stockQuantity: input.stockQuantity ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 5,
    },
  });
  return toPublicProduct(product);
}

export async function updateProductAdmin(id: number, input: Partial<{
  name: string;
  category: string;
  description: string;
  image: string | null;
  price: number | null;
  available: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
}>): Promise<PublicProduct> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error("Product not found.");
  const available = input.available ?? existing.available;
  const price = input.price !== undefined ? input.price : (existing.price ? Number(existing.price) : null);
  if (available && (price === null || price === undefined)) {
    throw new Error("Purchasable products must have a valid price.");
  }
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: input.name,
      category: input.category,
      description: input.description,
      image: input.image,
      price: input.price,
      available: input.available,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
    },
  });
  return toPublicProduct(product);
}

export async function archiveProductAdmin(id: number): Promise<PublicProduct> {
  const product = await prisma.product.update({
    where: { id },
    data: { available: false },
  });
  return toPublicProduct(product);
}

export async function adjustStockAdmin(
  productId: number,
  adminId: number,
  delta: number,
  reason: string
): Promise<{ product: PublicProduct; adjustment: { previous: number; new: number } }> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found.");
    const newQty = product.stockQuantity + delta;
    if (newQty < 0) throw new Error("Resulting stock cannot be negative.");
    await tx.product.update({ where: { id: productId }, data: { stockQuantity: newQty } });
    await tx.stockAdjustment.create({
      data: {
        productId,
        adminId,
        delta,
        reason,
        previousQuantity: product.stockQuantity,
        newQuantity: newQty,
      },
    });
    const updated = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    return { product: toPublicProduct(updated), adjustment: { previous: product.stockQuantity, new: newQty } };
  });
}

export async function replaceProductImageAdmin(id: number, imageUrl: string): Promise<PublicProduct> {
  const product = await prisma.product.update({
    where: { id },
    data: { image: imageUrl },
  });
  return toPublicProduct(product);
}
