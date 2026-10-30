"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { focusRing } from "./ui/Button";

const CURRENT_YEAR = "2026";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-container-lowest py-6 text-on-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 sm:flex-row">
        <div>
          <p className="font-bold text-primary">
            ESRP / CFRP Valentin Haüy — Centre de Formation et de Réadaptation Professionnelle
          </p>
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Association Valentin Haüy au service des personnes aveugles et malvoyantes · {CURRENT_YEAR}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1 text-xs font-bold text-primary">
            <ShieldCheck className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            RGAA 4.1 AAA &amp; WAI-ARIA
          </span>
          <Link
            href="/acces-refuse"
            className={`text-secondary hover:text-primary font-medium text-xs sm:text-sm underline underline-offset-2 ${focusRing}`}
          >
            Assistance &amp; Accessibilité
          </Link>
        </div>
      </div>
    </footer>
  );
}
