import type { Address } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import type { AddressInput, AddressUpdateInput } from "../schemas/address.schema.js";

export type PublicAddress = {
  id: number;
  customerId: number;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  label: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

function toPublicAddress(a: Address): PublicAddress {
  return {
    id: a.id,
    customerId: a.customerId,
    fullName: a.fullName,
    phone: a.phone,
    addressLine1: a.addressLine1,
    addressLine2: a.addressLine2,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    landmark: a.landmark,
    label: a.label,
    isDefault: a.isDefault,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function listAddresses(customerId: number): Promise<PublicAddress[]> {
  const rows = await prisma.address.findMany({
    where: { customerId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toPublicAddress);
}

export async function getAddress(customerId: number, id: number): Promise<PublicAddress | null> {
  const row = await prisma.address.findFirst({ where: { id, customerId } });
  if (!row) return null;
  return toPublicAddress(row);
}

export async function createAddress(customerId: number, input: AddressInput): Promise<PublicAddress> {
  const isDefault = input.isDefault ?? false;
  if (isDefault) {
    await prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  }
  // If first address, make default automatically? Optional. Keep as requested.
  const count = await prisma.address.count({ where: { customerId } });
  const makeDefault = isDefault || count === 0;
  if (makeDefault && !isDefault) {
    await prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  }
  const created = await prisma.address.create({
    data: {
      customerId,
      fullName: input.fullName,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 || null,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      landmark: input.landmark || null,
      label: input.label || null,
      isDefault: makeDefault,
    },
  });
  return toPublicAddress(created);
}

export async function updateAddress(
  customerId: number,
  id: number,
  input: AddressUpdateInput
): Promise<PublicAddress> {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw new ApiError(404, "Address not found.");

  if (input.isDefault === true) {
    await prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  const updated = await prisma.address.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 || null } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
      ...(input.landmark !== undefined ? { landmark: input.landmark || null } : {}),
      ...(input.label !== undefined ? { label: input.label || null } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
  return toPublicAddress(updated);
}

export async function deleteAddress(customerId: number, id: number): Promise<void> {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw new ApiError(404, "Address not found.");
  await prisma.address.delete({ where: { id } });
}

export async function setDefaultAddress(customerId: number, id: number): Promise<PublicAddress> {
  const existing = await prisma.address.findFirst({ where: { id, customerId } });
  if (!existing) throw new ApiError(404, "Address not found.");
  await prisma.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  const updated = await prisma.address.update({ where: { id }, data: { isDefault: true } });
  return toPublicAddress(updated);
}