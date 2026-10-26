import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`mx-auto max-w-md rounded-2xl border border-forest-800/10 bg-white p-8 text-center shadow-sm md:p-10 ${className}`}
    >
      {icon && (
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-cream-100 text-forest-300">
          {icon}
        </span>
      )}
      <h2 className="mt-5 font-display text-xl font-bold text-ink">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-forest-800">
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
