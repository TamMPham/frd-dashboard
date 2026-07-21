"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Loader2,
  Paperclip,
  PenLine,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type {
  DecisionItem,
  DraftContent,
  DraftContentUpdate,
  DraftItem,
  FyiItem,
  ReminderItem,
  SecurityItem,
  ThreadGroup,
} from "@/lib/types";

import { ActionButton, ConfirmButton, OpenLink, useRowAction } from "./actions";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

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

/** One "To/Cc/Subject" line in the letter header. */
function MetaLine({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2.5">
      <span className="w-9 shrink-0 pt-px font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </span>
      <span className="min-w-0 break-words text-[13px] leading-relaxed text-ink">
        {value}
      </span>
    </div>
  );
}

/** A labelled field in the edit form. */
function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

const INPUT_CLASS =
  "w-full rounded-lg border border-hairline-strong bg-surface px-3 py-2 text-sm text-ink transition-colors placeholder:text-faint focus:border-green focus:outline-none focus:ring-1 focus:ring-green";

function splitAddresses(value: string): string[] {
  return value
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * The staged draft's live Gmail content. Shared between DraftRow (Send
 * gating + confirmation details) and DraftPreview (the inline panel) —
 * react-query dedupes on the key, so it's still one background prefetch per
 * row. Disabled for rows without a physical Gmail draft.
 */
function useDraftContent(item: DraftItem) {
  return useQuery({
    queryKey: ["draft-content", item.id],
    queryFn: () => api<DraftContent>(`/api/drafts/${item.id}/content`),
    staleTime: 5 * 60_000,
    retry: 1,
    enabled: item.open_label === "Open draft",
  });
}

type SendAction = ReturnType<typeof useRowAction>;

/**
 * The staged Gmail draft, read live and shown in place so Peter can review —
 * and edit — it without leaving the dashboard. The content query runs on
 * mount (a background prefetch), so by the time he expands the panel it's
 * already cached and opens instantly. Saving writes back to the Gmail draft.
 * Sending lives on the row (DraftRow's Send button + confirmation dialog);
 * this panel only adds "Save & send" in edit mode, which saves first so
 * exactly what's on screen goes out. Sending from Gmail itself still works —
 * the reconcile sweep picks it up.
 */
function DraftPreview({
  item,
  send,
  onEditingChange,
}: {
  item: DraftItem;
  send: SendAction;
  onEditingChange: (editing: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveSendOpen, setSaveSendOpen] = useState(false);
  const [form, setForm] = useState({
    toText: "",
    ccText: "",
    subject: "",
    body: "",
  });
  const toast = useToast();
  const queryClient = useQueryClient();

  // The row hides its Send button while the form is open so stale saved
  // content can't be sent under unsaved on-screen edits.
  function updateEditing(next: boolean) {
    setEditing(next);
    onEditingChange(next);
  }

  const content = useDraftContent(item);

  const save = useMutation({
    mutationFn: (body: DraftContentUpdate) =>
      api<DraftContent>(`/api/drafts/${item.id}/content`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["draft-content", item.id], updated);
      updateEditing(false);
      toast("Draft saved to Gmail", true);
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Couldn't save the draft", false),
  });

  const c = content.data;

  function formPayload(): DraftContentUpdate {
    return {
      to: splitAddresses(form.toText),
      cc: splitAddresses(form.ccText),
      subject: form.subject,
      body: form.body,
    };
  }

  function startEdit() {
    if (!c) return;
    setForm({
      toText: c.to.join(", "),
      ccText: c.cc.join(", "),
      subject: c.subject,
      body: c.body,
    });
    updateEditing(true);
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[13px] font-medium text-green transition-colors hover:text-green-deep"
      >
        <ChevronRight
          className={clsx("size-3.5 transition-transform", open && "rotate-90")}
        />
        {open ? "Hide draft" : "Preview draft"}
        {content.isFetching && (
          <Loader2 className="size-3 animate-spin text-faint" />
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-hairline bg-paper p-4">
          {content.isLoading ? (
            <div className="space-y-2.5" aria-label="Loading draft">
              <div className="h-3 w-2/5 animate-pulse rounded bg-hairline" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-hairline" />
              <div className="mt-4 h-3 w-full animate-pulse rounded bg-hairline" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-hairline" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-hairline" />
            </div>
          ) : content.isError || !c ? (
            <p className="text-[13px] leading-snug text-muted">
              Couldn&apos;t load the draft here —{" "}
              {content.error instanceof ApiError
                ? content.error.message
                : "it may have been sent or discarded"}
              . Use{" "}
              <span className="font-medium text-ink">Open draft</span> to see it
              in Gmail.
            </p>
          ) : editing ? (
            <div className="space-y-2.5">
              <EditField label="To">
                <input
                  className={INPUT_CLASS}
                  value={form.toText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, toText: e.target.value }))
                  }
                  placeholder="name@example.com, …"
                  aria-label="To recipients"
                />
              </EditField>
              <EditField label="Cc">
                <input
                  className={INPUT_CLASS}
                  value={form.ccText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ccText: e.target.value }))
                  }
                  placeholder="optional"
                  aria-label="Cc recipients"
                />
              </EditField>
              <EditField label="Subject">
                <input
                  className={INPUT_CLASS}
                  value={form.subject}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  aria-label="Subject"
                />
              </EditField>
              <EditField label="Message">
                <textarea
                  className={clsx(INPUT_CLASS, "min-h-56 resize-y leading-relaxed")}
                  value={form.body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                  aria-label="Message body"
                />
              </EditField>
              {c.attachments.length > 0 && (
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
                  <Paperclip className="size-3" />
                  {c.attachments.join(" · ")} — kept on save
                </p>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] leading-snug text-faint">
                  {c.sendable
                    ? "Saves to the Gmail draft — Send goes out exactly as saved."
                    : "Saves to the Gmail draft. You still press Send in Gmail."}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <ActionButton
                    variant="quiet"
                    disabled={save.isPending || send.isPending}
                    aria-label="Cancel editing"
                    onClick={() => updateEditing(false)}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    variant={c.sendable ? "quiet" : "primary"}
                    busy={save.isPending}
                    disabled={send.isPending}
                    aria-label={`Save draft to Gmail: ${item.summary}`}
                    onClick={() => save.mutate(formPayload())}
                  >
                    Save to Gmail
                  </ActionButton>
                  {c.sendable && (
                    <ActionButton
                      variant="primary"
                      busy={save.isPending || send.isPending}
                      aria-label={`Save and send draft: ${item.summary}`}
                      onClick={() => setSaveSendOpen(true)}
                    >
                      Save &amp; send
                    </ActionButton>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 border-b border-hairline pb-3">
                <MetaLine label="To" value={c.to.join(", ")} />
                <MetaLine label="Cc" value={c.cc.join(", ")} />
                <MetaLine label="Subj" value={c.subject} />
              </div>
              <div className="mt-3 max-h-[26rem] overflow-y-auto whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">
                {c.body || (
                  <span className="italic text-faint">(empty draft)</span>
                )}
              </div>
              {c.attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-hairline pt-3">
                  {c.attachments.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[11px] text-muted"
                    >
                      <Paperclip className="size-3 text-faint" />
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {c.editable && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-green transition-colors hover:text-green-deep"
                  >
                    <PenLine className="size-3.5" />
                    Edit draft
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={saveSendOpen}
        title="Save & send?"
        confirmLabel="Send now"
        onClose={() => setSaveSendOpen(false)}
        onConfirm={async () => {
          setSaveSendOpen(false);
          // Save first so exactly what's on screen goes out; a failed save
          // aborts (its own error toast has fired).
          try {
            await save.mutateAsync(formPayload());
          } catch {
            return;
          }
          send.mutate({ path: `/api/drafts/${item.id}/send` });
        }}
      >
        <MetaLine label="To" value={splitAddresses(form.toText).join(", ")} />
        <MetaLine label="Cc" value={splitAddresses(form.ccText).join(", ")} />
        <MetaLine label="Subj" value={form.subject} />
        <p className="pt-1 text-[12px] leading-snug text-muted">
          Saves your edits to the Gmail draft first, then sends.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export function DraftRow({ item }: { item: DraftItem }) {
  const [leaving, setLeaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const action = useRowAction(() => setLeaving(true));
  const queryClient = useQueryClient();
  const content = useDraftContent(item);
  const c = content.data;

  const send = useRowAction(() => {
    // The row is leaving — drop its cached content along with it.
    queryClient.removeQueries({ queryKey: ["draft-content", item.id] });
    setLeaving(true);
  });

  // Hidden while the edit form is open: the saved draft on Gmail may lag the
  // unsaved edits on screen — "Save & send" in the form covers that path.
  const showSend = !!c?.sendable && !editing;

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
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-green transition-colors hover:text-green-deep [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            Review note
          </summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-paper p-3 font-mono text-xs leading-relaxed text-muted">
            {item.review_note}
          </pre>
        </details>
      )}

      {item.open_label === "Open draft" && (
        <DraftPreview item={item} send={send} onEditingChange={setEditing} />
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
          variant={showSend ? "quiet" : "primary"}
          busy={action.isPending}
          disabled={send.isPending}
          aria-label={`Mark draft done: ${item.summary}`}
          onClick={() => action.mutate({ path: `/api/drafts/${item.id}/done` })}
        >
          Done
        </ActionButton>
        {showSend && (
          <ActionButton
            variant="primary"
            busy={send.isPending}
            disabled={action.isPending}
            aria-label={`Send draft: ${item.summary}`}
            onClick={() => setSendOpen(true)}
          >
            Send
          </ActionButton>
        )}
      </div>

      <ConfirmDialog
        open={sendOpen}
        title="Send this draft?"
        confirmLabel="Send now"
        onClose={() => setSendOpen(false)}
        onConfirm={() => {
          setSendOpen(false);
          send.mutate({ path: `/api/drafts/${item.id}/send` });
        }}
      >
        {c && (
          <>
            <MetaLine label="To" value={c.to.join(", ")} />
            <MetaLine label="Cc" value={c.cc.join(", ")} />
            <MetaLine label="Subj" value={c.subject} />
          </>
        )}
        {item.review_note && (
          <p className="pt-1 text-[12px] leading-snug text-amber">
            Review note attached — check it before sending.
          </p>
        )}
        <p className="pt-1 text-[12px] leading-snug text-muted">
          Goes out exactly as staged in Gmail.
        </p>
      </ConfirmDialog>
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
