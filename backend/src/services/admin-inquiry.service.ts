import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";

const inquiryListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["PENDING", "READ", "RESOLVED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const inquiryUpdateSchema = z
  .object({
    status: z.enum(["PENDING", "READ", "RESOLVED"]).optional(),
    internalNotes: z.string().trim().max(2000, "Notes are too long.").nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.internalNotes !== undefined, {
    message: "Nothing to update.",
  });

export type InquiryRecord = {
  id: number;
  name: string;
  phone: string;
  email: string;
  product: string | null;
  message: string;
  status: "PENDING" | "READ" | "RESOLVED";
  internalNotes: string | null;
  createdAt: string;
};

export function toAdminInquiry(inquiry: {
  id: number;
  name: string;
  phone: string;
  email: string;
  product: string | null;
  message: string;
  status: string;
  internalNotes: string | null;
  createdAt: Date;
}): InquiryRecord {
  const status =
    inquiry.status === "READ" || inquiry.status === "RESOLVED" ? inquiry.status : "PENDING";
  return {
    id: inquiry.id,
    name: inquiry.name,
    phone: inquiry.phone,
    email: inquiry.email,
    product: inquiry.product,
    message: inquiry.message,
    status,
    internalNotes: inquiry.internalNotes,
    createdAt: inquiry.createdAt.toISOString(),
  };
}

export async function listAdminInquiries(rawQuery: unknown) {
  const query = inquiryListQuerySchema.parse(rawQuery);
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { name: { contains: query.q } },
      { phone: { contains: query.q } },
      { email: { contains: query.q } },
      { message: { contains: query.q } },
      { product: { contains: query.q } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.inquiry.count({ where }),
  ]);

  return {
    data: rows.map(toAdminInquiry),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

export async function updateAdminInquiry(
  id: number,
  input: z.infer<typeof inquiryUpdateSchema>
): Promise<InquiryRecord> {
  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Inquiry not found.");

  const updated = await prisma.inquiry.update({
    where: { id },
    data: {
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.internalNotes === undefined ? {} : { internalNotes: input.internalNotes }),
    },
  });
  return toAdminInquiry(updated);
}
