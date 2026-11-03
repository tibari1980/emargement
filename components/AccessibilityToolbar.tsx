"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Accessibility, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccessibility, type ContrastMode, type FontSize, type SpacingMode } from "./AccessibilityProvider";
import { Button, focusRing } from "./ui/Button";

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const { fontSize, contrast, spacing, setFontSize, setContrast, setSpacing, resetPreferences } =
    useAccessibility();

  // Raccourci clavier Alt + A pour ouvrir/fermer le panneau d'accessibilité
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          id="btn-accessibilite"
          type="button"
          aria-label="Accessibilité : options d'affichage et confort visuel (Alt + A). Raccourci Alt + M pour basculer en mode sombre"
          title="Accessibilité & Confort visuel (Alt + A) · Mode sombre (Alt + M)"
          className={`inline-flex min-h-10 items-center justify-center gap-1.5 sm:gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant shrink-0 ${focusRing}`}
        >
          <Accessibility className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
            A&#177;<span className="hidden lg:inline"> Accessibilité</span>
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[111] max-h-[90dvh] w-[min(94vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-4 sm:p-6 text-on-surface shadow-2xl focus:outline-none"
          aria-describedby="a11y-dialog-description"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg sm:text-2xl font-bold text-primary">
                Options d&apos;accessibilité visuelle
              </Dialog.Title>
              <Dialog.Description id="a11y-dialog-description" className="mt-1 text-xs sm:text-sm text-on-surface-variant">
                Adaptez l&apos;affichage de l&apos;application à vos besoins de lecture. Vos préférences sont conservées.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="secondary" className="!min-h-10 !px-3 text-xs sm:text-sm shrink-0">
                Fermer
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-5">
            {/* Taille de police */}
            <fieldset>
              <legend className="mb-2 text-sm sm:text-base font-bold text-primary">
                Taille du texte
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(
                  [
                    { id: "normal", label: "Standard (100%)", icon: "A" },
                    { id: "large", label: "Grand (125%)", icon: "A+" },
                    { id: "xlarge", label: "Très grand (140%)", icon: "A++" },
                  ] as const
                ).map(({ id, label, icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFontSize(id as FontSize)}
                    aria-pressed={fontSize === id}
                    className={`flex min-h-12 flex-row sm:flex-col items-center justify-between sm:justify-center gap-2 sm:gap-0.5 rounded-xl border-2 px-3 py-2 font-bold transition-all ${
                      fontSize === id
                        ? "border-primary bg-primary-container text-on-primary shadow-xs"
                        : "border-border-subtle bg-surface-container-low text-on-surface hover:bg-surface-container"
                    } ${focusRing}`}
                  >
                    <span className="text-lg sm:text-xl font-extrabold" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Contrastes */}
            <fieldset>
              <legend className="mb-2 text-sm sm:text-base font-bold text-primary">
                Contraste et couleurs
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    { id: "standard", label: "Standard", desc: "Couleurs officielles", shortcut: undefined },
                    { id: "high-contrast", label: "Contraste renforcé", desc: "Jaune sur fond noir", shortcut: undefined },
                    { id: "dark", label: "Mode sombre", desc: "Fond noir / texte blanc", shortcut: "Alt + M" },
                  ] as const
                ).map(({ id, label, desc, shortcut }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setContrast(id as ContrastMode)}
                    aria-pressed={contrast === id}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 p-2.5 text-center font-bold transition-all relative ${
                      contrast === id
                        ? "border-primary bg-primary-container text-on-primary shadow-xs"
                        : "border-border-subtle bg-surface-container-low text-on-surface hover:bg-surface-container"
                    } ${focusRing}`}
                  >
                    <span className="text-sm flex items-center gap-1.5">
                      <span>{label}</span>
                      {shortcut && (
                        <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-surface-container-highest text-on-surface border border-border-subtle font-bold">
                          {shortcut}
                        </kbd>
                      )}
                    </span>
                    <span className="text-xs font-normal opacity-90">{desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Espacement de lecture */}
            <fieldset>
              <legend className="mb-2 text-sm sm:text-base font-bold text-primary">
                Espacement de lecture
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    { id: "standard", label: "Standard", desc: "Interligne normal" },
                    { id: "relaxed", label: "Aéré (+20%)", desc: "Interligne et lettres espacées" },
                  ] as const
                ).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSpacing(id as SpacingMode)}
                    aria-pressed={spacing === id}
                    className={`flex min-h-12 flex-col items-center justify-center rounded-xl border-2 p-2.5 font-bold transition-all ${
                      spacing === id
                        ? "border-primary bg-primary-container text-on-primary shadow-xs"
                        : "border-border-subtle bg-surface-container-low text-on-surface hover:bg-surface-container"
                    } ${focusRing}`}
                  >
                    <span className="text-sm">{label}</span>
                    <span className="text-xs font-normal opacity-90">{desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {/* Raccourcis clavier pratiques */}
            <div className="rounded-xl border border-secondary/20 bg-surface-container-low p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-primary">
                <Keyboard className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
                <span>Raccourcis clavier rapides de l&apos;application</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle">
                  <span className="text-on-surface">Basculer Mode Sombre / Standard</span>
                  <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container text-primary border border-border-subtle text-[11px] shrink-0">Alt + M</kbd>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle">
                  <span className="text-on-surface">Centre de notifications</span>
                  <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container text-primary border border-border-subtle text-[11px] shrink-0">Alt + N</kbd>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle">
                  <span className="text-on-surface">Ouvrir ce menu d&apos;accessibilité</span>
                  <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container text-primary border border-border-subtle text-[11px] shrink-0">Alt + A</kbd>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle">
                  <span className="text-on-surface">Fermer dialogue ou modale</span>
                  <kbd className="font-mono font-bold px-1.5 py-0.5 rounded bg-surface-container text-primary border border-border-subtle text-[11px] shrink-0">Échap</kbd>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-container-lowest border border-border-subtle sm:col-span-2">
                  <span className="text-on-surface">Feuille d&apos;émargement (sur une ligne stagiaire)</span>
                  <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                    <kbd className="font-bold px-1.5 py-0.5 rounded bg-status-present-bg text-status-present border border-status-present-border">P</kbd>
                    <kbd className="font-bold px-1.5 py-0.5 rounded bg-status-late-bg text-status-late border border-status-late-border">R</kbd>
                    <kbd className="font-bold px-1.5 py-0.5 rounded bg-status-absent-bg text-status-absent border border-status-absent-border">A</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-border-subtle pt-4">
            <Button variant="secondary" onClick={resetPreferences} className="w-full sm:w-auto">
              Rétablir les valeurs par défaut
            </Button>
            <Dialog.Close asChild>
              <Button className="w-full sm:w-auto">Appliquer et fermer</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
