"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeSlash } from "../../lib/icons";

type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children?: ReactNode;
};

const inputBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-base text-ink placeholder:text-forest-600 focus:border-forest-600 focus:outline-2 focus:outline-offset-0 focus:outline-forest-600 transition-colors";

export function FormField({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  value,
  onChange,
  error,
  children,
}: FormFieldProps) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const renderedType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={renderedType}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputBase} ${
            isPassword ? "pr-12" : ""
          } ${error ? "border-red-400" : "border-forest-800/20"}`}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-forest-600 transition-colors hover:text-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
          >
            {show ? (
              <EyeSlash size={20} aria-hidden="true" />
            ) : (
              <Eye size={20} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        children
      )}
    </div>
  );
}