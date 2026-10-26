import { prisma } from "../config/prisma.js";
import { type InquiryInput } from "../schemas/product.schema.js";

export async function createInquiry(
  input: InquiryInput
): Promise<{ success: boolean; message: string }> {
  await prisma.inquiry.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      product: input.product || null,
      message: input.message,
    },
  });

  return {
    success: true,
    message: "Thank you! Your inquiry has been submitted. We will get back to you soon.",
  };
}

export async function listInquiriesAdmin(params: {
  status?: string;
  resolved?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const [items, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.inquiry.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export async function getInquiryAdmin(id: number) {
  return prisma.inquiry.findUnique({ where: { id } });
}

export async function updateInquiryAdmin(id: number, input: { status?: string; internalNotes?: string }) {
  return prisma.inquiry.update({
    where: { id },
    data: {
      status: input.status,
      internalNotes: input.internalNotes,
    },
  });
}
