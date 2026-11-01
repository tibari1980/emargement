"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAnnounce } from "./AccessibleAnnouncer";

export type FontSize = "normal" | "large" | "xlarge";
export type ContrastMode = "standard" | "high-contrast" | "dark";
export type SpacingMode = "standard" | "relaxed";

interface AccessibilityState {
  fontSize: FontSize;
  contrast: ContrastMode;
  spacing: SpacingMode;
  setFontSize: (size: FontSize) => void;
  setContrast: (contrast: ContrastMode) => void;
  setSpacing: (spacing: SpacingMode) => void;
  toggleDarkMode: () => void;
  resetPreferences: () => void;
}

interface Preferences {
  fontSize: FontSize;
  contrast: ContrastMode;
  spacing: SpacingMode;
}

const STORAGE_KEY = "avh_a11y_prefs";

const DEFAULT_PREFS: Preferences = {
  fontSize: "normal",
  contrast: "standard",
  spacing: "standard",
};

function getInitialPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        fontSize: parsed.fontSize || "normal",
        contrast: parsed.contrast || "standard",
        spacing: parsed.spacing || "standard",
      };
    }
  } catch {
    // Ignore localStorage errors (e.g. private browsing)
  }
  return DEFAULT_PREFS;
}

const AccessibilityContext = createContext<AccessibilityState>({
  fontSize: "normal",
  contrast: "standard",
  spacing: "standard",
  setFontSize: () => {},
  setContrast: () => {},
  setSpacing: () => {},
  toggleDarkMode: () => {},
  resetPreferences: () => {},
});

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(getInitialPreferences);
  const announce = useAnnounce();

  const { fontSize, contrast, spacing } = prefs;

  // Apply classes to document.documentElement and persist
  useEffect(() => {
    const root = document.documentElement;

    // Font size classes
    root.classList.remove("text-size-normal", "text-size-large", "text-size-xlarge");
    root.classList.add(`text-size-${fontSize}`);

    // Contrast classes
    root.classList.remove("contrast-standard", "contrast-high", "contrast-dark");
    if (contrast === "high-contrast") root.classList.add("contrast-high");
    else if (contrast === "dark") root.classList.add("contrast-dark");
    else root.classList.add("contrast-standard");

    // Spacing classes
    root.classList.remove("spacing-standard", "spacing-relaxed");
    root.classList.add(`spacing-${spacing}`);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontSize, contrast, spacing }));
    } catch {
      // Ignore
    }
  }, [fontSize, contrast, spacing]);

  const setFontSize = (size: FontSize) => {
    setPrefs((prev) => ({ ...prev, fontSize: size }));
    const labels: Record<FontSize, string> = {
      normal: "Taille de police standard activée.",
      large: "Grande taille de police activée (125%).",
      xlarge: "Très grande taille de police activée (140%).",
    };
    announce(labels[size]);
  };

  const setContrast = (mode: ContrastMode) => {
    setPrefs((prev) => ({ ...prev, contrast: mode }));
    const labels: Record<ContrastMode, string> = {
      standard: "Contraste standard activé.",
      "high-contrast": "Contraste renforcé jaune et noir activé.",
      dark: "Thème sombre à fort contraste activé.",
    };
    announce(labels[mode]);
  };

  const toggleDarkMode = () => {
    setContrast(contrast === "dark" ? "standard" : "dark");
  };

  // Raccourci clavier global d'accessibilité :
  // Alt + M (Mode sombre / clair) ou Alt + Shift + D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas déclencher si l'utilisateur saisit dans un champ de formulaire
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Alt + M ou Alt + Shift + D : bascule entre mode standard et mode sombre
      const isAltM = e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "m" || e.key === "M");
      const isAltShiftD = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === "d" || e.key === "D");

      if (isAltM || isAltShiftD) {
        e.preventDefault();
        setContrast(contrast === "dark" ? "standard" : "dark");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [contrast]);

  const setSpacing = (mode: SpacingMode) => {
    setPrefs((prev) => ({ ...prev, spacing: mode }));
    const labels: Record<SpacingMode, string> = {
      standard: "Interligne standard rétabli.",
      relaxed: "Interligne et espacement des lettres augmentés.",
    };
    announce(labels[mode]);
  };

  const resetPreferences = () => {
    setPrefs(DEFAULT_PREFS);
    announce("Paramètres d'accessibilité réinitialisés.");
  };

  return (
    <AccessibilityContext.Provider
      value={{
        fontSize,
        contrast,
        spacing,
        setFontSize,
        setContrast,
        setSpacing,
        toggleDarkMode,
        resetPreferences,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility(): AccessibilityState {
  return useContext(AccessibilityContext);
}
