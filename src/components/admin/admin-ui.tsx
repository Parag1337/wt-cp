"use client";

import type { ReactNode } from "react";
import { ArrowsClockwise, CheckCircle, MagnifyingGlass, WarningCircle, X } from "../../lib/icons";
import { Skeleton } from "../ui/skeleton";
import type { Pagination } from "../../lib/admin-api";
import { ariaSortFor, type SortDirection } from "../../lib/admin-form";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-forest-800">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function RefreshButton({
  onClick,
  refreshing,
  label = "Refresh",
}: {
  onClick: () => void;
  refreshing?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      className="inline-flex items-center gap-2 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
    >
      <ArrowsClockwise size={16} weight="bold" className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
      {refreshing ? "Refreshing…" : label}
    </button>
  );
}

export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-forest-800/10 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function AdminErrorBanner({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-2">
        <WarningCircle size={18} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="self-start rounded-full border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60 sm:self-auto"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}

export function AdminSuccessBanner({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-xl border border-leaf-300 bg-leaf-50 px-4 py-3 text-sm text-forest-800"
    >
      <span className="flex items-start gap-2">
        <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-forest-600" aria-hidden="true" />
        <span>{children}</span>
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="-my-1 -mr-1 rounded-md p-1 text-forest-600 hover:bg-leaf-100 hover:text-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-forest-800/8">
      <span className="sr-only">Loading data</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-live="polite">
      <span className="sr-only">Loading summary</span>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-forest-800/10 bg-white p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function AdminEmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-cream-100 text-forest-500">
          {icon}
        </span>
      )}
      <h2 className="mt-3 font-display text-base font-bold text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-forest-700">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function PaginationBar({
  pagination,
  onPageChange,
  busy,
}: {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
  busy?: boolean;
}) {
  if (!pagination || pagination.totalPages <= 1) {
    if (!pagination) return null;
    return (
      <div className="flex items-center justify-between border-t border-forest-800/10 px-4 py-3 text-xs text-forest-600">
        <span>
          {pagination.total} {pagination.total === 1 ? "record" : "records"}
        </span>
      </div>
    );
  }

  const { page, totalPages, total } = pagination;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col items-center justify-between gap-3 border-t border-forest-800/10 px-4 py-3 text-xs text-forest-700 sm:flex-row"
    >
      <span>
        Page {page} of {totalPages} · {total} records
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || busy}
          className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 font-semibold text-ink hover:bg-forest-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || busy}
          className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 font-semibold text-ink hover:bg-forest-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * Shared filter bar so every list screen has the same search field, select
 * controls, clear action and breakpoints.
 */
export function AdminFilterBar({
  children,
  onClear,
  clearable,
}: {
  children: ReactNode;
  onClear?: () => void;
  clearable?: boolean;
}) {
  return (
    <AdminCard className="mb-4 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">{children}</div>
        {clearable && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex shrink-0 items-center justify-center gap-1 self-start rounded-lg px-2 py-2 text-xs font-semibold text-forest-700 hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 lg:self-auto"
          >
            <X size={14} aria-hidden="true" /> Clear filters
          </button>
        )}
      </div>
    </AdminCard>
  );
}

/** Labelled search input used inside `AdminFilterBar` (visible label on small screens). */
export function AdminSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <MagnifyingGlass
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-500"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-forest-800/20 bg-white py-2 pl-9 pr-3 text-sm text-ink placeholder:text-forest-500 focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600"
      />
    </div>
  );
}

/** Labelled select for `AdminFilterBar`: a visible label, not just colour/placeholder. */
export function AdminSelectFilter({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:w-auto">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-forest-600">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-forest-800/20 bg-white px-3 py-2 text-sm text-ink focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 sm:w-auto"
      >
        {children}
      </select>
    </div>
  );
}

/**
 * Sortable table header for the current page.
 *
 * The list endpoints have no server-side `sort`, so this re-orders only the rows
 * already fetched. Screens pair it with a note saying so.
 */
export function SortableHeader({
  children,
  direction,
  onSort,
  align = "left",
  className = "",
}: {
  children: ReactNode;
  direction: SortDirection | null;
  onSort: () => void;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={direction ? ariaSortFor(direction) : undefined}
      className={`px-4 py-2.5 font-semibold ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1 rounded-sm uppercase tracking-[0.08em] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 ${
          align === "right" ? "flex-row-reverse" : ""
        } ${direction ? "text-forest-800" : ""}`}
      >
        {children}
        <span aria-hidden="true" className="text-[10px] leading-none">
          {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

/** Announced to screen readers when a filtered list changes. */
export function ResultsSummary({ text }: { text: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {text}
    </p>
  );
}
