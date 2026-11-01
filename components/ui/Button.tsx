import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-secondary text-on-secondary hover:bg-primary-container border-secondary shadow-xs",
  secondary: "bg-surface-container-lowest text-on-surface hover:bg-surface-variant border-border-subtle shadow-xs",
  danger: "bg-status-absent text-on-error hover:bg-red-800 border-status-absent shadow-xs",
};

/** High-contrast dual focus ring conforming to RGAA & WCAG 2.1 AAA (amber outer + navy inner) */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-focus-inner focus-visible:ring-4 focus-visible:ring-focus-outer focus-visible:ring-offset-1";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const hasDisplayClass = /\b(hidden|flex|inline-flex|block|grid|inline-block)\b/.test(className);
  const displayClass = hasDisplayClass ? "" : "inline-flex";
  return (
    <button
      type={type}
      className={`${displayClass} min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${focusRing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
