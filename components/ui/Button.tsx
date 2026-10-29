import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-blue-800 text-white hover:bg-blue-900 border-blue-800",
  secondary: "bg-white text-blue-900 hover:bg-blue-50 border-blue-800",
  danger: "bg-red-700 text-white hover:bg-red-800 border-red-700",
};

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
