"use client";

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff } from "lucide-react";
import { focusRing } from "./Button";

const controlClass = `block w-full min-w-0 min-h-11 rounded-xl border-2 border-border-strong bg-surface-container-lowest px-3 py-2 text-base sm:text-sm text-on-surface shadow-xs ${focusRing} aria-[invalid=true]:border-status-absent aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-status-absent`;

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
}

/** Label, hint and error message, all linked to the control for screen readers. */
function FieldShell({
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { children: (ids: { id: string; describedBy?: string; errorId?: string }) => ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-bold text-primary text-sm">
        {label}
        {required && (
          <span className="ml-1 text-status-absent" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (obligatoire)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-on-surface-variant font-medium">
          {hint}
        </p>
      )}
      {children({ id, describedBy, errorId })}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-bold text-status-absent">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  required,
  rightAdornment,
  className = "",
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement> & { rightAdornment?: ReactNode }) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, errorId }) => (
        <div className="relative flex items-center w-full">
          <input
            id={id}
            required={required}
            aria-required={required ? true : undefined}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-errormessage={error ? errorId : undefined}
            className={`${controlClass} ${rightAdornment ? "pr-12" : ""} ${className}`}
            {...props}
          />
          {rightAdornment && (
            <div className="absolute right-2 flex items-center justify-center">
              {rightAdornment}
            </div>
          )}
        </div>
      )}
    </FieldShell>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  required,
  className = "",
  ...props
}: FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      required={required}
      type={showPassword ? "text" : "password"}
      className={className}
      rightAdornment={
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors focus:outline-none focus:ring-2 focus:ring-focus-outer"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-on-surface" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5 text-on-surface" aria-hidden="true" />
          )}
        </button>
      }
      {...props}
    />
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, errorId }) => (
        <select
          id={id}
          required={required}
          aria-required={required ? true : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errorId : undefined}
          className={controlClass}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  rows = 3,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, errorId }) => (
        <textarea
          id={id}
          rows={rows}
          required={required}
          aria-required={required ? true : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-errormessage={error ? errorId : undefined}
          className={`${controlClass} min-h-24 resize-y`}
          {...props}
        />
      )}
    </FieldShell>
  );
}
