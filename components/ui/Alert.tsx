import { Loader2 } from "lucide-react";

type Tone = "info" | "success" | "error" | "warning";

const TONES: Record<Tone, string> = {
  info: "border-secondary bg-surface-container text-primary",
  success: "border-status-present bg-status-present-bg text-status-present",
  error: "border-status-absent bg-status-absent-bg text-status-absent",
  warning: "border-status-late bg-status-late-bg text-status-late",
};

/**
 * Visible message box. Errors use role="alert" (announced immediately);
 * other tones are static text — dynamic feedback goes through useAnnounce().
 */
export function Alert({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-xl border-l-4 border-y border-r border-border-subtle p-4 text-sm sm:text-base shadow-xs ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}

export function Loading({ label = "Chargement en cours…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-6 text-base font-semibold text-secondary">
      <Loader2 className="h-6 w-6 animate-spin text-secondary shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
