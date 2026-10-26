import type { Request, Response } from "express";
import { addressSchema, addressUpdateSchema } from "../schemas/address.schema.js";
import {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../services/address.service.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listAddressesHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const addresses = await listAddresses(customer.id);
  res.json({ success: true, addresses });
});

export const getAddressHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid address ID.");
  const address = await getAddress(customer.id, id);
  if (!address) throw new ApiError(404, "Address not found.");
  res.json({ success: true, address });
});

export const createAddressHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const input = addressSchema.parse(req.body);
  const address = await createAddress(customer.id, input);
  res.status(201).json({ success: true, address });
});

export const updateAddressHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid address ID.");
  const input = addressUpdateSchema.parse(req.body);
  const address = await updateAddress(customer.id, id, input);
  res.json({ success: true, address });
});

export const deleteAddressHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid address ID.");
  await deleteAddress(customer.id, id);
  res.json({ success: true });
});

export const setDefaultAddressHandler = asyncHandler(async (req, res) => {
  const customer = req.customer;
  if (!customer) throw new ApiError(401, "Unauthorized");
  const id = Number(req.params.id);
  if (isNaN(id)) throw new ApiError(400, "Invalid address ID.");
  const address = await setDefaultAddress(customer.id, id);
  res.json({ success: true, address });
});