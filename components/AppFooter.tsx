"use client";

import Link from "next/link";
import { Code2, ShieldCheck } from "lucide-react";
import { focusRing } from "./ui/Button";

const CURRENT_YEAR = "2026";

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-container-lowest py-6 text-on-surface">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold text-primary">
              ESRP / CFRP Valentin Haüy — Centre de Formation et de Réadaptation Professionnelle
            </p>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              © {CURRENT_YEAR} Association Valentin Haüy au service des personnes aveugles et malvoyantes · Tous droits réservés
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1 text-xs font-bold text-primary">
              <ShieldCheck className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
              RGAA 4.1 AAA &amp; WAI-ARIA
            </span>
            <Link
              href="/guide"
              className={`text-secondary hover:text-primary font-medium text-xs sm:text-sm underline underline-offset-2 ${focusRing}`}
            >
              Guide d&apos;utilisation pas-à-pas
            </Link>
            <Link
              href="/politique-confidentialite"
              className={`text-secondary hover:text-primary font-medium text-xs sm:text-sm underline underline-offset-2 ${focusRing}`}
            >
              Confidentialité &amp; RGPD
            </Link>
            <Link
              href="/acces-refuse"
              className={`text-secondary hover:text-primary font-medium text-xs sm:text-sm underline underline-offset-2 ${focusRing}`}
            >
              Assistance &amp; Accessibilité
            </Link>
          </div>
        </div>

        {/* Mention Copyright & Ingénieur de développement */}
        <div className="border-t border-border-subtle/70 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-on-surface-variant">
          <p className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Code2 className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
            <span>
              Copyright © {CURRENT_YEAR} — Application développée par{" "}
              <strong className="font-bold text-secondary">Tibari Zeroual</strong>, Ingénieur de développement
            </span>
          </p>
          <span className="text-[11px] text-on-surface-variant">
            Plateforme certifiée d&apos;émargement &amp; de suivi pédagogique adapté
          </span>
        </div>
      </div>
    </footer>
  );
}
