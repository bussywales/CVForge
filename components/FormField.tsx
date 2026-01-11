"use client";

import type { ReactNode } from "react";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label
        className="text-sm font-medium text-[rgb(var(--ink))]"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-xs text-[rgb(var(--muted))]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
