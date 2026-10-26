import type { Request, Response } from "express";
import { addToCartSchema, updateCartItemSchema } from "../schemas/cart.schema.js";
import {
  addToCart,
  getCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
} from "../services/cart.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const getCartHandler = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const cart = await getCart(customer.id);
  if (!cart) {
    return res.json({
      success: true,
      cart: { id: null, items: [], totalItems: 0, subtotal: null },
    });
  }

  res.json({ success: true, cart });
});

export const addToCartHandler = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const input = addToCartSchema.parse(req.body);
  const cart = await addToCart(customer.id, input);
  res.status(201).json({ success: true, cart });
});

export const updateCartItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const cartItemId = Number(req.params.id);
  if (isNaN(cartItemId)) throw new ApiError(400, "Invalid cart item ID.");

  const input = updateCartItemSchema.parse(req.body);

  const existingCart = await getCart(customer.id);
  if (!existingCart) throw new ApiError(404, "Cart not found.");

  const itemExists = existingCart.items.some((i) => i.id === cartItemId);
  if (!itemExists) throw new ApiError(404, "Cart item not found.");

  const cart = await updateCartItemQuantity(cartItemId, input.quantity);
  res.json({ success: true, cart });
});

export const removeCartItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const cartItemId = Number(req.params.id);
  if (isNaN(cartItemId)) throw new ApiError(400, "Invalid cart item ID.");

  const existingCart = await getCart(customer.id);
  if (!existingCart) throw new ApiError(404, "Cart not found.");

  const itemExists = existingCart.items.some((i) => i.id === cartItemId);
  if (!itemExists) throw new ApiError(404, "Cart item not found.");

  const cart = await removeCartItem(cartItemId);
  res.json({ success: true, cart });
});

export const clearCartHandler = asyncHandler(async (req: Request, res: Response) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");

  const cart = await clearCart(customer.id);
  res.json({ success: true, cart });
});
