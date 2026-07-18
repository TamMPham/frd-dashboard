"use client";

import clsx from "clsx";
import { AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { useState } from "react";

import type {
  DecisionItem,
  DraftItem,
  FyiItem,
  ReminderItem,
  SecurityItem,
  ThreadGroup,
} from "@/lib/types";

import { ActionButton, ConfirmButton, OpenLink, useRowAction } from "./actions";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-green-tint px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-green">
      {children}
    </span>
  );
}

function WarnLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] leading-snug text-amber">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Row({
  leaving,
  children,
}: {
  leaving: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      role="listitem"
      className={clsx(
        "border-t border-hairline py-4 first:border-t-0",
        leaving ? "row-leaving" : "row-live",
      )}
    >
      {children}
    </article>
  );
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function DecisionRow({ item }: { item: DecisionItem }) {
  const [leaving, setLeaving] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() =>
    item.files.map(() => true),
  );
  const action = useRowAction(() => setLeaving(true));

  const post = (verb: string, body?: unknown) =>
    action.mutate({ path: `/api/items/${item.id}/${verb}`, body });

  const fileable = item.real_approval && !item.unplaced;

  return (
    <Row leaving={leaving}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.type_label}</Badge>
        {item.project && (
          <span className="font-mono text-[11px] text-faint">{item.project}</span>
        )}
      </div>
      <p className="mt-1.5 leading-snug">{item.summary}</p>
      {item.tier_flag && <WarnLine>{item.tier_flag}</WarnLine>}

      {fileable && item.files.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-lg bg-paper p-3">
          {item.files.map((f, i) => (
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
                <span
                  className={clsx(
                    "block truncate font-mono text-xs",
                    f.dest_path ? "text-faint" : "text-amber",
                  )}
                >
                  {f.dest_path ?? "no destination — skipped"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fileable ? (
          <>
            <ActionButton
              variant="primary"
              busy={action.isPending}
              aria-label={`File selected documents: ${item.summary}`}
              onClick={() =>
                post("approve", {
                  selected: checked.flatMap((on, i) => (on ? [i] : [])),
                })
              }
            >
              File selected
            </ActionButton>
            <ConfirmButton
              label="Send admin"
              confirmLabel="Send to admin now"
              variant="admin"
              busy={action.isPending}
              ariaLabel={`Send filing to admin: ${item.summary}`}
              onConfirm={() => post("send_admin")}
            />
            <ConfirmButton
              label="Reject"
              confirmLabel="Confirm reject"
              variant="danger"
              busy={action.isPending}
              ariaLabel={`Reject: ${item.summary}`}
              onConfirm={() => post("reject")}
            />
          </>
        ) : item.unplaced ? (
          <>
            <ConfirmButton
              label="Send admin"
              confirmLabel="Send to admin now"
              variant="admin"
              busy={action.isPending}
              ariaLabel={`Send filing to admin: ${item.summary}`}
              onConfirm={() => post("send_admin")}
            />
            <ConfirmButton
              label="Reject"
              confirmLabel="Confirm reject"
              variant="danger"
              busy={action.isPending}
              ariaLabel={`Reject: ${item.summary}`}
              onConfirm={() => post("reject")}
            />
          </>
        ) : (
          <ActionButton
            variant="primary"
            busy={action.isPending}
            aria-label={`Mark handled: ${item.summary}`}
            onClick={() => post("approve")}
          >
            Done
          </ActionButton>
        )}
      </div>
    </Row>
  );
}

/* ── Drafts ────────────────────────────────────────────────────────────── */

export function DraftRow({ item }: { item: DraftItem }) {
  const [leaving, setLeaving] = useState(false);
  const action = useRowAction(() => setLeaving(true));

  return (
    <Row leaving={leaving}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.type_label}</Badge>
        <span className="font-mono text-[11px] text-faint">
          {item.status_label}
        </span>
      </div>
      <p className="mt-1.5 leading-snug">{item.summary}</p>

      {(item.delegation.length > 0 || item.delegation_missing) && (
        <p className="mt-1 text-[13px] leading-snug text-muted">
          <span className="font-medium text-ink">Delegating to:</span>{" "}
          {item.delegation_missing ? (
            <span className="text-amber">target not recorded</span>
          ) : (
            item.delegation
              .map(
                (d) =>
                  `${d.name || d.email}${d.email && d.name ? ` (${d.email})` : ""}${d.mode_label ? ` — ${d.mode_label}` : ""}`,
              )
              .join("; ")
          )}
        </p>
      )}
      {item.flags.length > 0 && <WarnLine>{item.flags.join("; ")}</WarnLine>}

      {item.review_note && (
        <details className="group mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-green">
            Review note
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-paper p-3 font-mono text-xs leading-relaxed text-muted">
            {item.review_note}
          </pre>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OpenLink
          href={item.open_url}
          ariaLabel={`${item.open_label}: ${item.summary} (opens Gmail)`}
        >
          {item.open_label}
          <ExternalLink className="ml-1.5 size-3.5 text-faint" />
        </OpenLink>
        <ActionButton
          variant="primary"
          busy={action.isPending}
          aria-label={`Mark draft done: ${item.summary}`}
          onClick={() => action.mutate({ path: `/api/drafts/${item.id}/done` })}
        >
          Done
        </ActionButton>
      </div>
    </Row>
  );
}

/* ── Thread group card (decisions + drafts) ────────────────────────────── */

export function ThreadGroupCard({ group }: { group: ThreadGroup }) {
  const count = group.decisions.length + group.drafts.length;
  const noun = group.decisions.length > 0 ? "action" : "draft";
  return (
    <section className="rounded-xl border border-hairline bg-surface px-5 pb-1 pt-4 shadow-[0_1px_2px_rgba(20,18,10,0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline pb-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium leading-tight">
            {group.subject}
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {[
              group.senders[0] &&
                `From: ${group.senders[0]}${group.senders.length > 1 ? ` +${group.senders.length - 1} more` : ""}`,
              group.projects[0] &&
                `Project: ${group.projects[0]}${group.projects.length > 1 ? ` +${group.projects.length - 1} more` : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] text-faint">
            {count} {count === 1 ? noun : `${noun}s`}
          </span>
          {group.open_url && (
            <a
              href={group.open_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open source email thread: ${group.subject} (opens Gmail)`}
              className="text-[13px] font-medium text-green hover:underline"
            >
              Open thread
            </a>
          )}
        </div>
      </div>
      <div role="list">
        {group.decisions.map((d) => (
          <DecisionRow key={d.id} item={d} />
        ))}
        {group.drafts.map((d) => (
          <DraftRow key={d.id} item={d} />
        ))}
      </div>
    </section>
  );
}

/* ── Follow-ups ────────────────────────────────────────────────────────── */

export function ReminderRow({ item }: { item: ReminderItem }) {
  const [leaving, setLeaving] = useState(false);
  const [days, setDays] = useState(3);
  const action = useRowAction(() => setLeaving(true));

  return (
    <Row leaving={leaving}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="leading-snug">
            {item.note}
            {item.project && (
              <span className="text-muted"> ({item.project})</span>
            )}
          </p>
          <p
            className={clsx(
              "mt-1 font-mono text-xs",
              item.overdue ? "font-medium text-red" : "text-faint",
            )}
          >
            due {item.due_at ? item.due_at.slice(0, 10) : "—"}
            {item.overdue && " · overdue"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ActionButton
            variant="primary"
            busy={action.isPending}
            aria-label={`Mark follow-up done: ${item.note}`}
            onClick={() =>
              action.mutate({ path: `/api/reminders/${item.id}/done` })
            }
          >
            Done
          </ActionButton>
          <span className="inline-flex items-center gap-1.5">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label={`Snooze duration for: ${item.note}`}
              className="h-11 rounded-lg border border-hairline-strong bg-surface px-2 text-sm lg:h-9"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>1 week</option>
            </select>
            <ActionButton
              variant="admin"
              busy={action.isPending}
              aria-label={`Snooze follow-up: ${item.note}`}
              onClick={() =>
                action.mutate({
                  path: `/api/reminders/${item.id}/snooze`,
                  body: { days },
                })
              }
            >
              Snooze
            </ActionButton>
          </span>
        </div>
      </div>
    </Row>
  );
}

/* ── FYI ───────────────────────────────────────────────────────────────── */

export function FyiRow({ item }: { item: FyiItem }) {
  return (
    <Row leaving={false}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{item.subject}</p>
          {item.sender && (
            <p className="mt-0.5 text-[13px] text-muted">{item.sender}</p>
          )}
          {item.gist && (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {item.gist}
            </p>
          )}
        </div>
        <OpenLink
          href={item.open_url}
          ariaLabel={`Open FYI email: ${item.subject} (opens Gmail)`}
        >
          Open email
          <ExternalLink className="ml-1.5 size-3.5 text-faint" />
        </OpenLink>
      </div>
    </Row>
  );
}

/* ── Security ──────────────────────────────────────────────────────────── */

export function SecurityRow({ item }: { item: SecurityItem }) {
  const [leaving, setLeaving] = useState(false);
  const action = useRowAction(() => setLeaving(true));

  return (
    <Row leaving={leaving}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">
            {item.subject}{" "}
            <span className="font-normal text-muted">— {item.from_email}</span>
          </p>
          {item.reason && (
            <p className="mt-0.5 text-[13px] text-muted">{item.reason}</p>
          )}
          <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-red">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Do not act by email — phone your known contact on their known
            number to verify.
          </p>
        </div>
        <ActionButton
          variant="admin"
          busy={action.isPending}
          aria-label={`Dismiss security alert: ${item.subject}`}
          onClick={() =>
            action.mutate({
              path: "/api/security/dismiss",
              body: { message_id: item.message_id },
            })
          }
        >
          Dismiss
        </ActionButton>
      </div>
    </Row>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-hairline px-5 py-6 text-center text-sm text-faint">
      {children}
    </p>
  );
}
