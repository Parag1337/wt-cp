"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { WarningCircle } from "../../lib/icons";

const fieldBase =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-forest-500 transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 disabled:bg-cream-100 disabled:text-forest-600";

function borderClass(invalid: boolean) {
  return invalid ? "border-red-400 focus:border-red-500 focus:outline-red-500" : "border-forest-800/20 focus:border-forest-600";
}

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className = "",
}: BaseProps & { id: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {optional && <span className="ml-1 font-normal text-forest-600">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1 text-xs font-medium text-red-700">
          <WarningCircle size={14} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-forest-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & { className?: string };

export function TextField({ label, hint, error, optional, className, ...rest }: TextFieldProps) {
  const generated = useId();
  const id = rest.name ?? generated;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${fieldBase} ${borderClass(Boolean(error))}`}
      />
    </FieldShell>
  );
}

type TextAreaFieldProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className"> & { className?: string };

export function TextAreaField({ label, hint, error, optional, className, ...rest }: TextAreaFieldProps) {
  const generated = useId();
  const id = rest.name ?? generated;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${fieldBase} min-h-28 resize-y ${borderClass(Boolean(error))}`}
      />
    </FieldShell>
  );
}

type SelectFieldProps = BaseProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & {
    className?: string;
    options: { value: string; label: string }[];
  };

export function SelectField({
  label,
  hint,
  error,
  optional,
  className,
  options,
  ...rest
}: SelectFieldProps) {
  const generated = useId();
  const id = rest.name ?? generated;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select
        {...rest}
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${fieldBase} ${borderClass(Boolean(error))}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-forest-800/15 bg-white px-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-forest-600">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="h-6 w-11 rounded-full bg-cream-200 ring-1 ring-inset ring-forest-800/15 transition-colors peer-checked:bg-leaf-500 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forest-600"
        />
        <span
          aria-hidden="true"
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
