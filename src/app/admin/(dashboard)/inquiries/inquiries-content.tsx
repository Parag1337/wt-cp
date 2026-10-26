"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  adminApi,
  AdminApiError,
  formatDateTime,
  INQUIRY_STATUSES,
  type AdminInquiry,
} from "@/lib/admin-api";
import {
  buildListQuery,
  nextInquiryStatus,
  normalizeInquiryStatus,
  ownerErrorMessage,
  readPage,
  type NormalizedInquiryStatus,
} from "@/lib/admin-form";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useAdminQuery } from "@/components/admin/use-admin-query";
import {
  AdminCard,
  AdminEmptyState,
  AdminErrorBanner,
  AdminFilterBar,
  AdminPageHeader,
  AdminSearchInput,
  AdminSelectFilter,
  AdminSuccessBanner,
  PaginationBar,
  RefreshButton,
  ResultsSummary,
  TableSkeleton,
} from "@/components/admin/admin-ui";
import { INQUIRY_STATUS_TONES, AdminBadge } from "@/components/admin/admin-badge";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { ChatCircleDots, EnvelopeSimple, PaperPlaneTilt, Phone } from "@/lib/icons";

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export default function InquiriesContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [page, setPage] = useState(() => readPage(searchParams));
  const [openId, setOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query);

  const result = useAdminQuery<AdminInquiry[]>(
    async (signal) => {
      const response = await adminApi.inquiries(
        buildListQuery({ q: debouncedQuery.trim(), status, pageSize: 20 }, page),
        signal
      );
      return { data: response.data, pagination: response.pagination };
    },
    [debouncedQuery, status, page]
  );

  const hasFilters = Boolean(debouncedQuery.trim() || status);

  function changeFilters(next: Partial<{ q: string; status: string }>) {
    if (next.q !== undefined) setQuery(next.q);
    if (next.status !== undefined) setStatus(next.status);
    setPage(1);
    setNotice(null);
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setNotice(null);
  }

  function clearFilters() {
    changeFilters({ q: "", status: "" });
  }

  function handleUpdated(updated: AdminInquiry) {
    setNotice(
      `Inquiry from ${updated.name} is now ${normalizeInquiryStatus(updated.status).toLowerCase()}.`
    );
    result.reload();
  }

  const errorMessage = result.error
    ? ownerErrorMessage(result.error, result.data ? "the latest inquiries" : "inquiries")
    : null;

  return (
    <>
      <AdminPageHeader
        title="Inquiries"
        description="Messages from customers through the contact form and product pages. Call or email them directly."
        actions={<RefreshButton onClick={result.reload} refreshing={result.refreshing} />}
      />

      {notice && (
        <div className="mb-4">
          <AdminSuccessBanner onDismiss={() => setNotice(null)}>{notice}</AdminSuccessBanner>
        </div>
      )}

      <AdminFilterBar onClear={clearFilters} clearable={hasFilters}>
        <AdminSearchInput
          id="inquiry-search"
          label="Search inquiries by name, phone, email or message"
          value={query}
          onChange={(value) => changeFilters({ q: value })}
          placeholder="Search name, phone, email or message"
        />
        <AdminSelectFilter
          id="inquiry-status"
          label="Status"
          value={status}
          onChange={(value) => changeFilters({ status: value })}
        >
          <option value="">All</option>
          {INQUIRY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </AdminSelectFilter>
      </AdminFilterBar>

      {errorMessage && (
        <div className="mb-4">
          <AdminErrorBanner
            message={result.data ? `Couldn't refresh inquiries. ${errorMessage}` : errorMessage}
            onRetry={result.reload}
            retrying={result.refreshing}
          />
        </div>
      )}

      {result.status === "loading" && !result.data ? (
        <AdminCard>
          <TableSkeleton rows={6} />
        </AdminCard>
      ) : result.data && result.data.length === 0 ? (
        <AdminCard>
          <AdminEmptyState
            icon={<ChatCircleDots size={22} aria-hidden="true" />}
            title={hasFilters ? "No inquiries match these filters" : "No inquiries yet"}
            description={
              hasFilters
                ? "Try a different search term or clear the status filter."
                : "Messages sent by customers will appear in this inbox."
            }
          >
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-forest-800/20 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
              >
                Clear filters
              </button>
            )}
          </AdminEmptyState>
        </AdminCard>
      ) : result.data ? (
        <>
          <ResultsSummary
            text={`Showing ${result.data.length} of ${result.pagination?.total ?? result.data.length} inquiries on page ${
              result.pagination?.page ?? page
            }.`}
          />
          <ul className="space-y-3">
            {result.data.map((inquiry) => {
              const open = openId === inquiry.id;
              const normalized = normalizeInquiryStatus(inquiry.status);
              return (
                <li key={inquiry.id}>
                  <AdminCard className="p-4 sm:p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-ink">{inquiry.name}</p>
                          <AdminBadge tone={INQUIRY_STATUS_TONES[normalized] ?? "neutral"}>
                            {normalized.toLowerCase()}
                          </AdminBadge>
                          {inquiry.product && (
                            <AdminBadge tone="info">About: {inquiry.product}</AdminBadge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-forest-600">
                          {formatDateTime(inquiry.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={telHref(inquiry.phone)}
                          aria-label={`Call ${inquiry.name} on ${inquiry.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                        >
                          <Phone size={14} aria-hidden="true" /> Call
                        </a>
                        <a
                          href={`mailto:${inquiry.email}?subject=${encodeURIComponent("Your inquiry with Jay Hari Krushi Seva Kendra")}`}
                          aria-label={`Email ${inquiry.name} on ${inquiry.email}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                        >
                          <EnvelopeSimple size={14} aria-hidden="true" /> Email
                        </a>
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : inquiry.id)}
                          aria-expanded={open}
                          aria-controls={`inquiry-details-${inquiry.id}`}
                          className="rounded-full border border-forest-800/20 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                        >
                          {open ? "Close" : "Details"}
                        </button>
                      </div>
                    </div>

                    <p
                      id={`inquiry-details-${inquiry.id}`}
                      className={`mt-3 whitespace-pre-line text-sm leading-relaxed text-forest-800 ${open ? "" : "line-clamp-3"}`}
                    >
                      {inquiry.message}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forest-600">
                      <a href={telHref(inquiry.phone)} className="hover:underline">
                        {inquiry.phone}
                      </a>
                      <a href={`mailto:${inquiry.email}`} className="break-all hover:underline">
                        {inquiry.email}
                      </a>
                    </div>

                    {open && (
                      <InquiryActions inquiry={inquiry} onUpdated={handleUpdated} />
                    )}
                  </AdminCard>
                </li>
              );
            })}
          </ul>

          <div className="mt-4">
            <AdminCard>
              <PaginationBar
                pagination={result.pagination}
                onPageChange={changePage}
                busy={result.refreshing}
              />
            </AdminCard>
          </div>
        </>
      ) : errorMessage ? (
        <AdminCard>
          <AdminEmptyState
            title="Nothing to show right now"
            description="Fix the problem above, then try again."
          />
        </AdminCard>
      ) : null}
    </>
  );
}

function InquiryActions({
  inquiry,
  onUpdated,
}: {
  inquiry: AdminInquiry;
  onUpdated: (inquiry: AdminInquiry) => void;
}) {
  const [notes, setNotes] = useState(inquiry.internalNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState(false);

  async function save(status: NormalizedInquiryStatus, internalNotes?: string) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await adminApi.updateInquiry(inquiry.id, {
        status,
        ...(internalNotes === undefined ? {} : { internalNotes: internalNotes.trim() || null }),
      });
      onUpdated(response.inquiry);
      if (internalNotes !== undefined) setSaved(true);
    } catch (err) {
      setError(
        err instanceof AdminApiError
          ? ownerErrorMessage(err, "this inquiry")
          : "The inquiry couldn't be updated. Check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const current = normalizeInquiryStatus(inquiry.status);
  const next = nextInquiryStatus(inquiry.status);

  return (
    <div className="mt-4 space-y-3 border-t border-forest-800/10 pt-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`notes-${inquiry.id}`} className="text-sm font-semibold text-ink">
          Internal notes <span className="font-normal text-forest-600">(not visible to the customer)</span>
        </label>
        <textarea
          id={`notes-${inquiry.id}`}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setSaved(false);
          }}
          maxLength={2000}
          placeholder="What did you tell them? When did you follow up?"
          className="min-h-20 w-full resize-y rounded-xl border border-forest-800/20 bg-white px-3 py-2 text-sm text-ink focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600"
        />
      </div>

      {error && <AdminErrorBanner message={error} />}
      {saved && (
        <p role="status" className="text-xs font-medium text-forest-700">
          Notes saved.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => save(current, notes)}
          disabled={saving}
          className="rounded-full bg-forest-800 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save notes"}
        </button>
        <button
          type="button"
          onClick={() => save(next)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full border border-forest-800/20 bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
        >
          <PaperPlaneTilt size={14} aria-hidden="true" />
          {next === "PENDING" ? "Reopen inquiry" : `Mark as ${next.toLowerCase()}`}
        </button>
        {current !== "RESOLVED" && (
          <button
            type="button"
            onClick={() => setConfirmResolve(true)}
            disabled={saving}
            className="rounded-full border border-leaf-300 bg-leaf-50 px-4 py-2 text-xs font-semibold text-forest-800 hover:bg-leaf-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
          >
            Resolve
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmResolve}
        title="Mark this inquiry as resolved?"
        description={
          <>
            <strong>{inquiry.name}</strong>&apos;s inquiry will be marked resolved so it is easy to
            tell apart from new messages. You can reopen it later.
          </>
        }
        confirmLabel="Mark resolved"
        onConfirm={async () => {
          await save("RESOLVED");
          setConfirmResolve(false);
        }}
        onClose={() => setConfirmResolve(false)}
      />
    </div>
  );
}
