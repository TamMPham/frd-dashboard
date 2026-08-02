"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { ActionResult } from "@/lib/types";

import { useToast } from "./toast";

/**
 * One mutation per row action. On success the row stays put as a full-height
 * "✓ done" tombstone (the caller marks it in the completed set via a
 * per-call onSuccess) — no collapse, no immediate refetch, so nothing shifts
 * under Peter's cursor; the 60s poll brings the fresh payload. A 409/404
 * means another surface (the digest email, another tab) got there first —
 * resync right away.
 */
export function useRowAction() {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      api<ActionResult>(path, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    onSuccess: (result) => {
      toast(result.message, true);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Request failed";
      toast(message, false);
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      }
    },
  });
}

const VARIANTS = {
  primary:
    "bg-green text-white hover:bg-green-deep border border-transparent",
  quiet:
    "border border-hairline-strong bg-surface text-ink hover:border-green hover:text-green",
  danger:
    "border border-hairline-strong bg-surface text-red hover:border-red hover:bg-red-tint",
  admin:
    "border border-hairline-strong bg-surface text-muted hover:border-ink hover:text-ink",
} as const;

export function ActionButton({
  variant = "quiet",
  busy = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={clsx(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:opacity-55 lg:h-9",
        VARIANTS[variant],
        className,
      )}
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** Inline confirm for irreversible verbs: first tap arms, second fires. */
export function ConfirmButton({
  label,
  confirmLabel,
  variant,
  busy,
  onConfirm,
  ariaLabel,
}: {
  label: string;
  confirmLabel: string;
  variant: keyof typeof VARIANTS;
  busy?: boolean;
  onConfirm: () => void;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <ActionButton
        variant={variant}
        busy={busy}
        aria-label={ariaLabel ?? label}
        onClick={() => setArmed(true)}
      >
        {label}
      </ActionButton>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <ActionButton
        variant={variant === "danger" ? "danger" : "primary"}
        busy={busy}
        aria-label={`Confirm: ${ariaLabel ?? label}`}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
        className={variant === "danger" ? "border-red bg-red-tint" : ""}
      >
        {confirmLabel}
      </ActionButton>
      <ActionButton
        variant="quiet"
        aria-label="Cancel"
        onClick={() => setArmed(false)}
      >
        Cancel
      </ActionButton>
    </span>
  );
}

export function OpenLink({
  href,
  children,
  ariaLabel,
}: {
  href: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="inline-flex h-11 items-center justify-center rounded-lg border border-hairline-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-green hover:text-green lg:h-9"
    >
      {children}
    </a>
  );
}
