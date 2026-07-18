"use client";

import clsx from "clsx";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import type { TokenPeek, TokenResult } from "@/lib/types";

export default function TokenConfirm({
  token,
  peek,
}: {
  token: string;
  peek: TokenPeek;
}) {
  const [checked, setChecked] = useState<boolean[]>(() =>
    peek.files.map(() => true),
  );
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TokenResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (peek.select_files) {
        body.selected = checked.flatMap((on, i) => (on ? [i] : []));
      }
      if (peek.snooze_choices.length > 0 && peek.verb === "snooze") {
        body.days = days;
      }
      const res = await fetch(`/api/t/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          payload && typeof payload.detail === "string"
            ? payload.detail
            : "Something went wrong — the action was NOT completed.",
        );
      } else {
        setResult(payload as TokenResult);
      }
    } catch {
      setError("Network problem — the action may not have completed.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="rise rounded-xl border border-hairline bg-surface p-6">
        <p className="flex items-center gap-2 font-display text-2xl font-medium text-green">
          <CheckCircle2 className="size-6" />
          {result.title}
        </p>
        <p className="mt-2 text-muted">{result.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {peek.select_files && peek.files.length > 0 && (
        <ul className="space-y-1.5 rounded-lg bg-paper p-3">
          {peek.files.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={checked[i] ?? true}
                onChange={(e) =>
                  setChecked((c) => {
                    const next = [...c];
                    next[i] = e.target.checked;
                    return next;
                  })
                }
                aria-label={`Include ${f.name} in filing`}
                className="mt-1 size-4 shrink-0 accent-(--green)"
              />
              <span className="min-w-0 text-sm leading-snug">
                {f.name}
                {f.size_kb != null && (
                  <span className="ml-1.5 font-mono text-xs text-faint">
                    {f.size_kb} KB
                  </span>
                )}
                <span
                  className={clsx(
                    "block truncate font-mono text-xs",
                    f.dest_path ? "text-faint" : "text-amber",
                  )}
                >
                  {f.dest_path ?? "no destination — will be skipped"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!peek.select_files && peek.files.length > 0 && (
        <ul className="rounded-lg bg-paper p-3 text-sm">
          {peek.files.map((f, i) => (
            <li key={i} className="py-0.5">
              {f.name}
            </li>
          ))}
        </ul>
      )}

      {peek.sends_to && (
        <p className="text-sm font-medium text-red">
          This SENDS immediately to {peek.sends_to} when you confirm.
        </p>
      )}

      {peek.snooze_choices.length > 0 && peek.verb === "snooze" && (
        <fieldset className="space-y-1.5">
          <legend className="sr-only">Snooze duration</legend>
          {peek.snooze_choices.map((d) => (
            <label key={d} className="flex items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="days"
                checked={days === d}
                onChange={() => setDays(d)}
                className="size-4 accent-(--green)"
              />
              {d === 1 ? "Tomorrow" : d === 3 ? "In 3 days" : "Next week"}
            </label>
          ))}
        </fieldset>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg bg-red-tint px-4 py-3 text-sm text-red">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        onClick={confirm}
        disabled={busy}
        className={clsx(
          "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg px-6 font-medium text-white transition-colors disabled:opacity-60 sm:w-auto",
          peek.verb === "reject"
            ? "bg-red hover:opacity-90"
            : peek.verb === "send_admin"
              ? "bg-ink hover:opacity-90"
              : "bg-green hover:bg-green-deep",
        )}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {peek.confirm_label}
      </button>

      <p className="text-xs text-faint">
        Nothing happens until you confirm. This button works once.
      </p>
    </div>
  );
}
