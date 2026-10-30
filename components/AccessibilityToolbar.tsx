"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Accessibility } from "lucide-react";
import { useState } from "react";
import { useAccessibility, type ContrastMode, type FontSize, type SpacingMode } from "./AccessibilityProvider";
import { Button, focusRing } from "./ui/Button";

export function AccessibilityToolbar() {
  const [open, setOpen] = useState(false);
  const { fontSize, contrast, spacing, setFontSize, setContrast, setSpacing, resetPreferences } =
    useAccessibility();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Options d'accessibilité visuelle (taille du texte, contrastes, espacements)"
          className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-border-subtle bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface transition-colors hover:bg-surface-variant ${focusRing}`}
        >
          <Accessibility className="h-4 w-4 text-secondary shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-bold">A&#177;<span className="hidden sm:inline"> Accessibilité</span></span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(94vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-4 border-blue-900 bg-white p-5 sm:p-6 shadow-2xl focus:outline-none"
          aria-describedby="a11y-dialog-description"
        >
          <div className="flex items-start justify-between gap-4 border-b-2 border-gray-200 pb-4">
            <div>
              <Dialog.Title className="text-2xl font-bold text-gray-950">
                Options d&apos;accessibilité visuelle
              </Dialog.Title>
              <Dialog.Description id="a11y-dialog-description" className="mt-1 text-base text-gray-800">
                Adaptez l&apos;affichage de l&apos;application à vos besoins de lecture. Vos préférences sont conservées.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="secondary" className="!min-h-10 text-sm">
                Fermer
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-6 flex flex-col gap-6">
            {/* Taille de police */}
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-gray-950">
                Taille du texte
              </legend>
              <div className="grid grid-cols-3 gap-2">
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
                    className={`flex min-h-12 flex-col items-center justify-center rounded-lg border-2 p-2 font-bold transition-all ${
                      fontSize === id
                        ? "border-blue-900 bg-blue-900 text-white shadow-md ring-2 ring-blue-900 ring-offset-2"
                        : "border-gray-400 bg-gray-50 text-gray-900 hover:bg-gray-100"
                    } ${focusRing}`}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {icon}
                    </span>
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Contrastes */}
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-gray-950">
                Contraste et couleurs
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    { id: "standard", label: "Standard", desc: "Couleurs officielles" },
                    { id: "high-contrast", label: "Contraste renforcé", desc: "Jaune sur fond noir" },
                    { id: "dark", label: "Mode sombre", desc: "Fond noir / texte blanc" },
                  ] as const
                ).map(({ id, label, desc }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setContrast(id as ContrastMode)}
                    aria-pressed={contrast === id}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 p-2 text-center font-bold transition-all ${
                      contrast === id
                        ? "border-blue-900 bg-blue-900 text-white shadow-md ring-2 ring-blue-900 ring-offset-2"
                        : "border-gray-400 bg-gray-50 text-gray-900 hover:bg-gray-100"
                    } ${focusRing}`}
                  >
                    <span className="text-sm">{label}</span>
                    <span className="text-xs font-normal opacity-90">{desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Espacement de lecture */}
            <fieldset>
              <legend className="mb-2 text-lg font-bold text-gray-950">
                Espacement de lecture
              </legend>
              <div className="grid grid-cols-2 gap-2">
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
                    className={`flex min-h-12 flex-col items-center justify-center rounded-lg border-2 p-2 font-bold transition-all ${
                      spacing === id
                        ? "border-blue-900 bg-blue-900 text-white shadow-md ring-2 ring-blue-900 ring-offset-2"
                        : "border-gray-400 bg-gray-50 text-gray-900 hover:bg-gray-100"
                    } ${focusRing}`}
                  >
                    <span className="text-sm">{label}</span>
                    <span className="text-xs font-normal opacity-90">{desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-gray-200 pt-4">
            <Button variant="secondary" onClick={resetPreferences}>
              Rétablir les valeurs par défaut
            </Button>
            <Dialog.Close asChild>
              <Button>Appliquer et fermer</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
