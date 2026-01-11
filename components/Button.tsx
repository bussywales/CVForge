"use client";

import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseStyles =
  "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[rgb(var(--accent))] text-white shadow-sm hover:bg-[rgb(var(--accent-strong))]",
  secondary:
    "border border-black/10 bg-white/70 text-[rgb(var(--ink))] hover:border-black/20",
  ghost: "text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:border-red-300",
};

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
