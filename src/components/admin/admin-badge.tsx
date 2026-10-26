"use client";

import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, string> = {
  success: "bg-leaf-100 text-forest-700 ring-leaf-300/60",
  warning: "bg-gold-300/30 text-ink ring-gold-400/50",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-forest-50 text-forest-700 ring-forest-200",
  neutral: "bg-cream-100 text-forest-700 ring-forest-800/10",
};

export function AdminBadge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export const ORDER_STATUS_TONES: Record<string, Tone> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  packed: "info",
  shipped: "info",
  delivered: "success",
  completed: "success",
  cancelled: "danger",
};

export const PAYMENT_STATUS_TONES: Record<string, Tone> = {
  paid: "success",
  cod_due: "neutral",
  pending: "warning",
  failed: "danger",
  refunded: "neutral",
};

export const INQUIRY_STATUS_TONES: Record<string, Tone> = {
  PENDING: "warning",
  READ: "info",
  RESOLVED: "success",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <AdminBadge tone={ORDER_STATUS_TONES[key] ?? "neutral"}>{key}</AdminBadge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <AdminBadge tone={PAYMENT_STATUS_TONES[key] ?? "neutral"}>{key.replace(/_/g, " ")}</AdminBadge>
  );
}

export function StockBadge({
  state,
  quantity,
}: {
  state: "out" | "low" | "ok";
  quantity: number;
}) {
  if (state === "out") return <AdminBadge tone="danger">Out of stock</AdminBadge>;
  if (state === "low") return <AdminBadge tone="warning">Low · {quantity}</AdminBadge>;
  return <AdminBadge tone="success">{quantity} in stock</AdminBadge>;
}
