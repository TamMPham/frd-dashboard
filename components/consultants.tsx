"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowLeft, Plus, Search, VolumeX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { ConsultantBody, ConsultantEntry } from "@/lib/types";

import { ActionButton, ConfirmButton } from "./actions";
import { useToast } from "./toast";

/**
 * The sender directory, editable. Only listed senders get classified —
 * everything else is skipped at the pipeline's directory gate — so this page
 * is how Peter adds a new consultant, agent or platform (and removes ones
 * that no longer belong). Changes take effect on the very next email.
 */

const KNOWN_ROLES = [
  "solicitor",
  "surveyor",
  "civil_engineer",
  "town_planner",
  "builder",
  "utility",
  "electrical",
  "council",
  "developer",
  "agent",
  "property_manager",
  "buyer",
  "financier",
  "bank",
  "broker",
  "tax_accountant",
  "smsf_accountant",
  "bookkeeper",
  "lawyer",
  "insurer",
  "esign",
  "investor",
];

const TIERS = ["routine", "elevated", "sensitive"] as const;

const TIER_STYLE: Record<string, string> = {
  routine: "bg-green-tint text-green",
  elevated: "bg-amber-tint text-amber",
  sensitive: "bg-red-tint text-red",
};

const TIER_HINT: Record<string, string> = {
  routine: "one-tap approvals",
  elevated: "flagged: verify before approving",
  sensitive: "money/legal/investor — verify before approving",
};

const INPUT =
  "w-full rounded-lg border border-hairline-strong bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-faint focus:border-green focus:outline-none focus:ring-1 focus:ring-green";

const EMPTY_FORM: ConsultantBody = {
  pattern: "",
  match_type: "domain",
  party_name: "",
  role: "",
  tier: "elevated",
  never_noise: false,
  notes: "",
};

function validate(form: ConsultantBody): string | null {
  const pattern = form.pattern.trim().toLowerCase();
  if (!pattern) return "Enter a domain or email address.";
  if (/\s/.test(pattern)) return "The pattern can't contain spaces.";
  if (form.match_type === "email" && !pattern.includes("@"))
    return "An email pattern needs an @.";
  if (form.match_type === "domain" && pattern.includes("@"))
    return "A domain pattern shouldn't contain an @ — switch to Email.";
  if (form.match_type === "domain" && !pattern.includes("."))
    return "That doesn't look like a domain.";
  return null;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

function EntryForm({
  initial,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ConsultantBody;
  saving: boolean;
  submitLabel: string;
  onSubmit: (body: ConsultantBody) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ConsultantBody>(initial);
  const [problem, setProblem] = useState<string | null>(null);

  const set = <K extends keyof ConsultantBody>(
    key: K,
    value: ConsultantBody[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const error = validate(form);
        setProblem(error);
        if (!error) {
          onSubmit({
            ...form,
            pattern: form.pattern.trim().toLowerCase(),
            role: form.role.trim().toLowerCase().replace(/\s+/g, "_"),
          });
        }
      }}
    >
      <Field label="Name">
        <input
          className={INPUT}
          value={form.party_name}
          onChange={(e) => set("party_name", e.target.value)}
          placeholder="ONF Surveyors"
        />
      </Field>
      <Field label="Role">
        <input
          className={INPUT}
          value={form.role}
          onChange={(e) => set("role", e.target.value)}
          list="consultant-roles"
          placeholder="surveyor"
        />
        <datalist id="consultant-roles">
          {KNOWN_ROLES.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>
      <Field label="Match by">
        <select
          className={INPUT}
          value={form.match_type}
          onChange={(e) =>
            set("match_type", e.target.value as ConsultantBody["match_type"])
          }
        >
          <option value="domain">Domain (whole firm)</option>
          <option value="email">Email (one person)</option>
        </select>
      </Field>
      <Field
        label={form.match_type === "domain" ? "Domain" : "Email address"}
      >
        <input
          className={INPUT}
          value={form.pattern}
          onChange={(e) => set("pattern", e.target.value)}
          placeholder={
            form.match_type === "domain"
              ? "onfsurveyors.com.au"
              : "howard@onfsurveyors.com.au"
          }
        />
      </Field>
      <Field label="Tier">
        <select
          className={INPUT}
          value={form.tier}
          onChange={(e) =>
            set("tier", e.target.value as ConsultantBody["tier"])
          }
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t} — {TIER_HINT[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Notes">
        <input
          className={INPUT}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="optional"
        />
      </Field>
      <label className="flex items-center gap-2 text-[13px] text-ink sm:col-span-2">
        <input
          type="checkbox"
          checked={form.never_noise}
          onChange={(e) => set("never_noise", e.target.checked)}
          className="size-4 accent-(--green)"
        />
        Never treat as noise
        <span className="text-faint">
          — keeps no-reply/notification senders actionable
        </span>
      </label>
      {problem && (
        <p className="text-[13px] font-medium text-red sm:col-span-2">
          {problem}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 sm:col-span-2">
        <ActionButton
          type="button"
          variant="quiet"
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel"
        >
          Cancel
        </ActionButton>
        <ActionButton
          type="submit"
          variant="primary"
          busy={saving}
          aria-label={submitLabel}
        >
          {submitLabel}
        </ActionButton>
      </div>
    </form>
  );
}

export default function Consultants() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const list = useQuery({
    queryKey: ["consultants"],
    queryFn: () => api<ConsultantEntry[]>("/api/consultants"),
    staleTime: 60_000,
  });

  const fail = (e: unknown) =>
    toast(e instanceof ApiError ? e.message : "Request failed", false);
  const refetch = () =>
    queryClient.invalidateQueries({ queryKey: ["consultants"] });

  const create = useMutation({
    mutationFn: (body: ConsultantBody) =>
      api<ConsultantEntry>("/api/consultants", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (entry) => {
      toast(`Added ${entry.party_name || entry.pattern}`, true);
      setAdding(false);
      refetch();
    },
    onError: fail,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ConsultantBody }) =>
      api<ConsultantEntry>(`/api/consultants/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (entry) => {
      toast(`Saved ${entry.party_name || entry.pattern}`, true);
      setEditingId(null);
      refetch();
    },
    onError: fail,
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      api<{ ok: boolean; message: string }>(`/api/consultants/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (r) => {
      toast(r.message, true);
      refetch();
    },
    onError: fail,
  });

  const entries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data ?? []).filter((e) => {
      if (tierFilter && e.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        e.pattern.includes(q) ||
        e.party_name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q)
      );
    });
  }, [list.data, search, tierFilter]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-5 pb-24 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Freedom Road · Donna
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            Consultants
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
            Who Donna listens to. Emails from anyone not listed here are
            skipped without triage — add new consultants, agents and platforms
            as they appear; changes apply to the next email.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-medium text-green transition-colors hover:text-green-deep"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
      </header>

      <div className="rise flex flex-wrap items-center gap-2 pb-4">
        <label className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            className={clsx(INPUT, "pl-9")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address or role…"
            aria-label="Search consultants"
          />
        </label>
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter((cur) => (cur === t ? null : t))}
            aria-pressed={tierFilter === t}
            className={clsx(
              "rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide transition-colors",
              tierFilter === t
                ? TIER_STYLE[t]
                : "border border-hairline-strong text-muted hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
        <ActionButton
          variant="primary"
          aria-label="Add a consultant"
          onClick={() => {
            setAdding((a) => !a);
            setEditingId(null);
          }}
        >
          <Plus className="size-4" />
          Add
        </ActionButton>
      </div>

      {adding && (
        <div className="rise mb-4 rounded-xl border border-hairline bg-surface p-5">
          <h2 className="mb-3 font-display text-xl font-medium">
            New consultant
          </h2>
          <EntryForm
            initial={EMPTY_FORM}
            saving={create.isPending}
            submitLabel="Add consultant"
            onSubmit={(body) => create.mutate(body)}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {list.isPending ? (
        <div className="space-y-3" aria-label="Loading">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl border border-hairline bg-surface"
            />
          ))}
        </div>
      ) : list.isError ? (
        <p className="rounded-xl border border-dashed border-hairline px-5 py-6 text-center text-sm text-faint">
          Couldn&apos;t load the directory —{" "}
          {list.error instanceof ApiError
            ? list.error.message
            : "is the backend running?"}
        </p>
      ) : (
        <div className="rise rounded-xl border border-hairline bg-surface">
          <div className="border-b border-hairline px-5 py-2.5 font-mono text-[11px] text-faint">
            {entries.length} of {list.data?.length ?? 0} listed
          </div>
          <ul>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-hairline px-5 py-3.5 last:border-b-0"
              >
                {editingId === entry.id ? (
                  <EntryForm
                    initial={entry}
                    saving={update.isPending}
                    submitLabel="Save changes"
                    onSubmit={(body) => update.mutate({ id: entry.id, body })}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium leading-snug">
                          {entry.party_name || entry.pattern}
                        </span>
                        {entry.role && (
                          <span className="rounded-full bg-green-tint px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-green">
                            {entry.role.replace(/_/g, " ")}
                          </span>
                        )}
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
                            TIER_STYLE[entry.tier],
                          )}
                        >
                          {entry.tier}
                        </span>
                        {entry.never_noise && (
                          <span
                            title="Never treated as noise"
                            className="text-faint"
                          >
                            <VolumeX className="size-3.5" />
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-muted">
                        {entry.match_type === "domain" ? "@" : ""}
                        {entry.pattern}
                        {entry.notes && (
                          <span className="text-faint"> — {entry.notes}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ActionButton
                        variant="quiet"
                        aria-label={`Edit ${entry.party_name || entry.pattern}`}
                        onClick={() => {
                          setEditingId(entry.id);
                          setAdding(false);
                        }}
                      >
                        Edit
                      </ActionButton>
                      <ConfirmButton
                        label="Delete"
                        confirmLabel="Confirm delete"
                        variant="danger"
                        busy={remove.isPending}
                        ariaLabel={`Delete ${entry.party_name || entry.pattern}`}
                        onConfirm={() => remove.mutate(entry.id)}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
            {entries.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-faint">
                No matches — clear the search or add a new entry.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
