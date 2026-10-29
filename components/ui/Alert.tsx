type Tone = "info" | "success" | "error" | "warning";

const TONES: Record<Tone, string> = {
  info: "border-blue-800 bg-blue-50 text-blue-950",
  success: "border-green-800 bg-green-50 text-green-950",
  error: "border-red-800 bg-red-50 text-red-950",
  warning: "border-amber-700 bg-amber-50 text-amber-950",
};

/**
 * Visible message box. Errors use role="alert" (announced immediately);
 * other tones are static text — dynamic feedback goes through useAnnounce().
 */
export function Alert({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-md border-l-8 p-4 ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Loading({ label = "Chargement en cours…" }: { label?: string }) {
  return (
    <p role="status" className="py-6 text-lg">
      {label}
    </p>
  );
}
