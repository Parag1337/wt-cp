"use client";

import { Button } from "../button";
import { WarningCircle } from "../../lib/icons";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this right now. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`mx-auto max-w-md rounded-2xl border border-forest-800/10 bg-white p-8 text-center shadow-sm md:p-10 ${className}`}
    >
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50 text-red-600">
        <WarningCircle size={28} weight="bold" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-forest-800">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}
