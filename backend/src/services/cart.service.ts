import type { Cart, CartItem, Product } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { addToCartSchema, type AddToCartInput } from "../schemas/cart.schema.js";
import { ApiError } from "../utils/apiError.js";

export type PublicCartItem = {
  id: number;
  productId: number;
  productName: string;
  productCategory: string;
  productImage: string | null;
  unitPrice: string | null;
  available: boolean;
  quantity: number;
};

export type PublicCart = {
  id: number;
  customerId: number;
  items: PublicCartItem[];
  totalItems: number;
  subtotal: string | null;
};

function toPublicCartItem(item: CartItem & { product: Product }): PublicCartItem {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    productCategory: item.product.category,
    productImage: item.product.image,
    unitPrice: item.product.price ? item.product.price.toString() : null,
    available: item.product.available,
    quantity: item.quantity,
  };
}

export async function getCart(customerId: number): Promise<PublicCart | null> {
  const cart = await prisma.cart.findUnique({
    where: { customerId },
    include: {
      items: {
        include: { product: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cart) return null;

  const items = cart.items.map(toPublicCartItem);
  const subtotal = items.reduce((sum, item) => {
    const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
    return sum + price * item.quantity;
  }, 0);

  return {
    id: cart.id,
    customerId: cart.customerId,
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: subtotal > 0 ? subtotal.toFixed(2) : null,
  };
}

export async function getOrCreateCart(customerId: number): Promise<Cart> {
  const cart = await prisma.cart.upsert({
    where: { customerId },
    update: {},
    create: { customerId },
  });
  return cart;
}

/**
 * Cart-boundary stock guard (B-3, coordinated — see docs/admin-api-contract.md §6):
 * the storefront should not accumulate a cart that cannot be checked out.
 * Checkout/order placement REMAINS the authoritative validator (transactional,
 * oversell-proof); this is a friendlier earlier rejection using the same stock
 * values — no inventory business logic lives here.
 */
function assertPurchasable(
  product: Pick<Product, "available" | "stockQuantity" | "name">,
  requestedQuantity: number
): void {
  if (!product.available) {
    throw new ApiError(409, "This product is not currently available.");
  }
  const stock = product.stockQuantity ?? 0;
  if (stock <= 0) {
    throw new ApiError(409, `Sorry, "${product.name}" is out of stock right now.`);
  }
  if (requestedQuantity > stock) {
    throw new ApiError(409, `Sorry, only ${stock} unit${stock === 1 ? "" : "s"} of "${product.name}" left in stock.`);
  }
}

export async function addToCart(
  customerId: number,
  input: AddToCartInput
): Promise<PublicCart> {
  const cart = await getOrCreateCart(customerId);

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: input.productId },
    select: { available: true, stockQuantity: true, name: true, archivedAt: true },
  });
  if (product.archivedAt) {
    throw new ApiError(409, "This product is not currently available.");
  }

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
  });

  assertPurchasable(product, (existing?.quantity ?? 0) + input.quantity);

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: { increment: input.quantity } },
      include: { product: true },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: input.productId,
        quantity: input.quantity,
      },
      include: { product: true },
    });
  }

  const updated = await getCart(customerId);
  if (!updated) throw new Error("Failed to update cart");
  return updated;
}

export async function updateCartItemQuantity(
  cartItemId: number,
  quantity: number
): Promise<PublicCart> {
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    select: { cartId: true },
  });

  if (!item) throw new Error("Cart item not found");

  // Keep the cart honest with current stock (see assertPurchasable above);
  // re-caps run on every update, so a restored product is purchasable again.
  const current = await prisma.cartItem.findUniqueOrThrow({
    where: { id: cartItemId },
    select: { product: { select: { available: true, stockQuantity: true, name: true } } },
  });
  assertPurchasable(current.product, quantity);

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });

  const cart = await prisma.cart.findUnique({
    where: { id: item.cartId },
    include: {
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!cart) throw new Error("Cart not found");

  const items = cart.items.map(toPublicCartItem);
  const subtotal = items.reduce((sum, i) => {
    const price = i.unitPrice ? parseFloat(i.unitPrice) : 0;
    return sum + price * i.quantity;
  }, 0);

  return {
    id: cart.id,
    customerId: cart.customerId,
    items,
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: subtotal > 0 ? subtotal.toFixed(2) : null,
  };
}

export async function removeCartItem(
  cartItemId: number
): Promise<PublicCart> {
  const item = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    select: { cartId: true },
  });

  if (!item) throw new Error("Cart item not found");

  await prisma.cartItem.delete({ where: { id: cartItemId } });

  const cart = await prisma.cart.findUnique({
    where: { id: item.cartId },
    include: {
      items: { include: { product: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!cart) throw new Error("Cart not found");

  const items = cart.items.map(toPublicCartItem);
  const subtotal = items.reduce((sum, i) => {
    const price = i.unitPrice ? parseFloat(i.unitPrice) : 0;
    return sum + price * i.quantity;
  }, 0);

  return {
    id: cart.id,
    customerId: cart.customerId,
    items,
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: subtotal > 0 ? subtotal.toFixed(2) : null,
  };
}

export async function clearCart(customerId: number): Promise<PublicCart> {
  const cart = await getOrCreateCart(customerId);

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  return {
    id: cart.id,
    customerId,
    items: [],
    totalItems: 0,
    subtotal: null,
  };
}
