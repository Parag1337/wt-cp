"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "../../lib/icons";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  /** Optional free-text field (e.g. a timeline note). */
  noteLabel?: string;
  noteValue?: string;
  notePlaceholder?: string;
  onNoteChange?: (value: string) => void;
  /** May be async: the dialog shows a busy state and surfaces thrown errors. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

/**
 * Accessible confirmation modal: labelled by its title, closes on Escape/backdrop,
 * moves focus to Cancel, traps Tab inside the panel, and restores focus on close.
 * Errors thrown by `onConfirm` are shown inside the dialog so it stays open.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "default",
  noteLabel,
  noteValue,
  notePlaceholder,
  onNoteChange,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const noteId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
    // `busy` is read through the latest handler; re-binding on busy keeps Escape correct.
  }, [open, busy, onClose]);

  if (!open || typeof document === "undefined") return null;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "The change wasn't saved. Please try again."
      );
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-forest-950/45"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative w-full max-w-md rounded-2xl border border-forest-800/10 bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1 text-forest-600 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm leading-relaxed text-forest-800">
            {description}
          </div>
        )}

        {noteLabel && onNoteChange && (
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor={noteId} className="text-sm font-semibold text-ink">
              {noteLabel}
            </label>
            <textarea
              id={noteId}
              value={noteValue ?? ""}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder={notePlaceholder}
              maxLength={500}
              disabled={busy}
              className="min-h-20 w-full resize-y rounded-xl border border-forest-800/20 bg-white px-3 py-2 text-sm text-ink focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600"
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full border border-forest-800/20 bg-white px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 disabled:opacity-60 ${
              tone === "danger"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-forest-800 text-white hover:bg-forest-900"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
