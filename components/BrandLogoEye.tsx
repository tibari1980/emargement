"use client";

import React from "react";

export interface BrandLogoEyeProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  withContainer?: boolean;
}

/**
 * Logo officiel emblématique de l'ESRP / CFRP Valentin Haüy : « L'Œil de l'Autonomie & de l'Inclusion ».
 * Conçu spécifiquement pour une accessibilité maximale :
 * - Totalement silencieux pour les lecteurs d'écran (NVDA, JAWS, VoiceOver, Orca) grâce à `aria-hidden="true"`.
 * - Sémantique d'accueil portée par le lien parent `<Link href="/" aria-label="Accueil émargement CFRP Valentin Haüy">`.
 * - Contraste optimal (ratio > 15:1 en standard, jaune signalétique sur noir pur en contraste élevé).
 */
export function BrandLogoEye({
  size = "md",
  className = "",
  withContainer = true,
}: BrandLogoEyeProps) {
  // Dimensions du conteneur et de l'icône selon la taille
  const containerSizes = {
    sm: "h-8 w-8 sm:h-9 sm:w-9 rounded-xl",
    md: "h-9 w-9 sm:h-10 sm:w-10 rounded-xl",
    lg: "h-13 w-13 sm:h-14 sm:w-14 rounded-2xl",
    xl: "h-16 w-16 sm:h-20 sm:w-20 rounded-3xl",
  };

  const iconSizes = {
    sm: "h-4.5 w-4.5 sm:h-5 sm:w-5",
    md: "h-5 w-5 sm:h-5.5 sm:w-5.5",
    lg: "h-7 w-7 sm:h-8 sm:w-8",
    xl: "h-9 w-9 sm:h-11 sm:w-11",
  };

  const svgIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${iconSizes[size]} text-current transition-transform duration-300 group-hover:scale-105`}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      {/* 1. Contour de l'Œil : Galbe moderne, dynamique et protecteur */}
      <path
        d="M2.5 12C3.9 7.6 7.6 4.6 12 4.6C16.4 4.6 20.1 7.6 21.5 12C20.1 16.4 16.4 19.4 12 19.4C7.6 19.4 3.9 16.4 2.5 12Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. Iris : Cercle d'attention et de précision */}
      <circle
        cx="12"
        cy="12"
        r="3.8"
        stroke="currentColor"
        strokeWidth="1.9"
      />

      {/* 3. Pupille : Point focal de l'autonomie */}
      <circle
        cx="12"
        cy="12"
        r="1.9"
        fill="currentColor"
      />

      {/* 4. Éclat lumineux : Reflet d'espoir et de clarté */}
      <circle
        cx="13.4"
        cy="10.6"
        r="0.75"
        fill="#ffffff"
        className="opacity-95"
      />
    </svg>
  );

  if (!withContainer) {
    return svgIcon;
  }

  return (
    <div
      className={`group relative flex shrink-0 items-center justify-center bg-primary-container text-white shadow-sm border border-white/10 transition-all duration-200 ${containerSizes[size]} ${className}`}
      aria-hidden="true"
    >
      {svgIcon}
    </div>
  );
}
