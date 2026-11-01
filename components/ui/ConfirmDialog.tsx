"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "./Button";

/**
 * Confirmation before a destructive action. Radix handles the focus trap,
 * Escape key, focus restoration and the dialog ARIA attributes.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerAccessibleLabel,
  title,
  description,
  confirmLabel = "Confirmer",
  triggerVariant = "danger",
  onConfirm,
}: {
  triggerLabel: string;
  /** Full label for screen readers when the visible one is short ("Supprimer"). */
  triggerAccessibleLabel?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerVariant?: "primary" | "secondary" | "danger";
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={triggerVariant} aria-label={triggerAccessibleLabel}>
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] max-h-[90dvh] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border-2 border-border-strong bg-surface-container-lowest p-4 sm:p-6 text-on-surface shadow-2xl">
          <Dialog.Title className="text-lg sm:text-2xl font-bold text-primary">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-xs sm:text-base text-on-surface-variant">{description}</Dialog.Description>
          <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" className="w-full sm:w-auto">Annuler</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={confirm} disabled={busy} className="w-full sm:w-auto">
              {busy ? "Traitement…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
