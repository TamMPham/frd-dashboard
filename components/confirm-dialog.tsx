"use client";

import { useEffect, useRef } from "react";

import { ActionButton } from "./actions";

/**
 * Native <dialog> confirmation modal for irreversible verbs (the Send flow).
 * showModal() gives the focus trap, inert background and Esc handling for
 * free; the parent owns `open`, closes on confirm, and fires the action —
 * progress lives on the originating button and the toast reports the result.
 * Esc and backdrop clicks cancel without confirming.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="confirm-dialog m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-hairline bg-surface p-0 text-ink shadow-2xl"
      onCancel={(e) => {
        // Esc: route through the parent's state so open/close has one owner.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Content clicks land on the inner padding div; only true backdrop
        // clicks have the dialog element itself as the target.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="p-5">
        <h3 className="font-display text-xl font-medium">{title}</h3>
        {children && <div className="mt-3 space-y-1.5">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <ActionButton variant="quiet" aria-label="Cancel" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            busy={busy}
            aria-label={`Confirm: ${title}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </dialog>
  );
}
