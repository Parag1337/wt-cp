import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Customer } from "../generated/client/client.js";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { ConflictError, UnauthorizedError } from "../utils/apiError.js";

export type PublicCustomer = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  /** Server-side role. Used by the admin UI for navigation only; every admin
   *  endpoint re-checks it in the database (see requireAdmin). */
  role: "ADMIN" | "CUSTOMER";
};

export function toPublicCustomer(customer: Customer): PublicCustomer {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    role: customer.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
  };
}

function signToken(customerId: number): string {
  return jwt.sign({ sub: String(customerId) }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as jwt.SignOptions["expiresIn"],
  });
}

export async function registerCustomer(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ customer: PublicCustomer; token: string }> {
  const existing = await prisma.customer.findFirst({
    where: {
      OR: [{ email: input.email }, { phone: input.phone }],
    },
    select: { email: true, phone: true },
  });

  if (existing) {
    if (existing.email === input.email) {
      throw new ConflictError("An account with this email already exists.");
    }
    throw new ConflictError("An account with this phone number already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
  const customer = await prisma.customer.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      passwordHash,
    },
  });

  return { customer: toPublicCustomer(customer), token: signToken(customer.id) };
}

export async function loginCustomer(input: {
  email: string;
  password: string;
}): Promise<{ customer: PublicCustomer; token: string }> {
  const customer = await prisma.customer.findUnique({
    where: { email: input.email },
  });

  if (!customer) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  const valid = await bcrypt.compare(input.password, customer.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  return { customer: toPublicCustomer(customer), token: signToken(customer.id) };
}

export async function getCustomerById(id: number): Promise<PublicCustomer> {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) {
    throw new UnauthorizedError();
  }
  return toPublicCustomer(customer);
}

export async function loginAdmin(input: {
  email: string;
  password: string;
}): Promise<{ customer: PublicCustomer; token: string }> {
  const result = await loginCustomer(input);
  if (result.customer.role !== "ADMIN") {
    throw new UnauthorizedError("Invalid email or password.");
  }
  return result;
}

export async function changePassword(
  customerId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new UnauthorizedError();
  }

  const valid = await bcrypt.compare(currentPassword, customer.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Current password is incorrect.");
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await prisma.customer.update({ where: { id: customerId }, data: { passwordHash } });
}