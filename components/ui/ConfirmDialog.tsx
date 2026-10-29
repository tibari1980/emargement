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
  onConfirm,
}: {
  triggerLabel: string;
  /** Full label for screen readers when the visible one is short ("Supprimer"). */
  triggerAccessibleLabel?: string;
  title: string;
  description: string;
  confirmLabel?: string;
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
        <Button variant="danger" aria-label={triggerAccessibleLabel}>
          {triggerLabel}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="text-2xl font-bold">{title}</Dialog.Title>
          <Dialog.Description className="mt-3 text-lg">{description}</Dialog.Description>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary">Annuler</Button>
            </Dialog.Close>
            <Button variant="danger" onClick={confirm} disabled={busy}>
              {busy ? "Suppression…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
