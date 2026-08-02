"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ExternalLink,
  Loader2,
  Paperclip,
  PenLine,
  ShieldAlert,
  X,
} from "lucide-react";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";
import type {
  ContactSuggestion,
  DecisionItem,
  DraftContent,
  DraftContentUpdate,
  DraftItem,
  DraftSendBody,
  EmailBody,
  FyiItem,
  ReminderItem,
  SecurityItem,
  ThreadGroup,
  ThreadView,
} from "@/lib/types";

import { ActionButton, ConfirmButton, OpenLink, useRowAction } from "./actions";
import { type Section, useCompleted } from "./completed";
import { ConfirmDialog } from "./confirm-dialog";
import { RecipientInput } from "./recipient-input";
import { useToast } from "./toast";

/** Where a thread-section row lives, so its tombstone can hold its place. */
export interface RowCtx {
  section: Section;
  group: ThreadGroup;
  groupIndex: number;
  rowIndex: number;
}

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
  done,
  children,
}: {
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      role="listitem"
      className={clsx(
        "border-t border-hairline py-4 first:border-t-0",
        done && "row-done",
      )}
    >
      {children}
    </article>
  );
}

/**
 * Replaces a row's button strip once its action lands: same height as the
 * buttons it stands in for, so the row — and everything below it — keeps its
 * exact place until the next natural refresh.
 */
function CompletedMark({ label }: { label: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-3 flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-green lg:min-h-9"
    >
      <Check className="size-4" />
      {label}
    </p>
  );
}

/** "22 Jul · 3:41 pm" — when the source email arrived. */
function formatReceived(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function ReceivedStamp({ iso }: { iso: string | null }) {
  const text = formatReceived(iso);
  if (!text) return null;
  return (
    <span className="font-mono text-[11px] text-faint">received {text}</span>
  );
}

const EMAIL_STALE_MS = 5 * 60_000;

/** Warm the email-body cache from hover/focus so opening feels instant. */
function useEmailPrefetch(messageId: string | null | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!messageId) return;
    queryClient.prefetchQuery({
      queryKey: ["email-body", messageId],
      queryFn: () => api<EmailBody>(`/api/emails/${messageId}`),
      staleTime: EMAIL_STALE_MS,
    });
  };
}

/**
 * The original email as quoted correspondence — so Peter can see what he's
 * dealing with without the Gmail round-trip that loses his spot in the
 * queue. Mounted only while its disclosure is open, so the body loads
 * lazily and stays cached for 5 minutes.
 */
function EmailBodyPanel({ messageId }: { messageId: string }) {
  const email = useQuery({
    queryKey: ["email-body", messageId],
    queryFn: () => api<EmailBody>(`/api/emails/${messageId}`),
    staleTime: EMAIL_STALE_MS,
    retry: 1,
  });

  const meta = email.data
    ? ["From " + email.data.sender, formatReceived(email.data.received_at)]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="rounded-lg border-l-2 border-hairline-strong bg-paper py-3 pl-4 pr-3">
      {email.isPending ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-3 w-1/3 animate-pulse rounded bg-hairline" />
          <div className="h-3 w-full animate-pulse rounded bg-hairline" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-hairline" />
        </div>
      ) : email.isError ? (
        <p className="text-[13px] text-faint">
          Couldn&apos;t load this email — use the Open thread link instead.
        </p>
      ) : email.data && !email.data.body ? (
        <p className="text-[13px] text-faint">
          No text content in this email — open it in Gmail.
        </p>
      ) : email.data ? (
        <>
          <p className="mb-2 font-mono text-[11px] text-faint">{meta}</p>
          {/* The bottom fade covers only the padding once scrolled to the
              end, so it hints at more content without hiding any. */}
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap pb-5 text-sm leading-relaxed text-ink [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)]">
            {email.data.body}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Self-contained disclosure + panel, used by FYI rows (each FYI row is its
 * own heading). Thread cards render their single toggle in the card header
 * instead — see ThreadGroupCard.
 */
function EmailPeek({
  messageId,
  subject,
  label = "Read email",
}: {
  messageId: string | null;
  subject: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const prefetch = useEmailPrefetch(messageId);

  if (!messageId) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-expanded={open}
        aria-label={`${label}: ${subject}`}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 text-[13px] font-medium text-green transition-colors hover:text-green-deep lg:min-h-6"
      >
        <ChevronRight
          className={clsx("size-3.5 transition-transform", open && "rotate-90")}
        />
        {label}
      </button>
      {open && (
        <div className="mt-2">
          <EmailBodyPanel messageId={messageId} />
        </div>
      )}
    </div>
  );
}

/* ── Full thread view ──────────────────────────────────────────────────── */

const THREAD_STALE_MS = 5 * 60_000;

function threadQueryOpts(threadId: string) {
  return {
    queryKey: ["thread", threadId] as const,
    queryFn: () => api<ThreadView>(`/api/threads/${threadId}`),
    staleTime: THREAD_STALE_MS,
    retry: 1,
  };
}

/** Warm the thread cache from hover/focus so opening feels instant. */
function useThreadPrefetch(threadId: string) {
  const queryClient = useQueryClient();
  return () => {
    if (!threadId) return;
    queryClient.prefetchQuery(threadQueryOpts(threadId));
  };
}

/**
 * The whole conversation, Gmail-style: older messages collapse to one-line
 * headers (click to expand each), the latest arrives open. Read live from
 * Gmail so Peter's own replies are included; mounted only while the
 * disclosure is open so the round-trip is lazy and cached.
 */
function ThreadPanel({ threadId }: { threadId: string }) {
  const thread = useQuery(threadQueryOpts(threadId));
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const messages = thread.data?.messages ?? [];

  return (
    <div className="rounded-lg border-l-2 border-hairline-strong bg-paper py-1 pl-4 pr-3">
      {thread.isPending ? (
        <div className="space-y-2 py-2" aria-hidden>
          <div className="h-3 w-1/3 animate-pulse rounded bg-hairline" />
          <div className="h-3 w-full animate-pulse rounded bg-hairline" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-hairline" />
        </div>
      ) : thread.isError ? (
        <p className="py-2 text-[13px] text-faint">
          Couldn&apos;t load the thread — use the Open thread link instead.
        </p>
      ) : messages.length === 0 ? (
        <p className="py-2 text-[13px] text-faint">
          No messages found — open the thread in Gmail.
        </p>
      ) : (
        messages.map((m, i) => {
          const isLast = i === messages.length - 1;
          const isOpen = toggled[m.message_id] ?? isLast;
          const who = m.from_name || m.from_email || "(unknown sender)";
          const stamp = formatReceived(m.date);
          return (
            <div
              key={m.message_id}
              className={clsx(
                "py-2",
                i > 0 && "border-t border-hairline",
              )}
            >
              <button
                type="button"
                onClick={() =>
                  setToggled((t) => ({ ...t, [m.message_id]: !isOpen }))
                }
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Collapse" : "Expand"} message from ${who}`}
                className="flex w-full min-w-0 cursor-pointer items-baseline gap-2 text-left"
              >
                <ChevronRight
                  className={clsx(
                    "size-3 shrink-0 translate-y-0.5 text-faint transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                <span
                  className={clsx(
                    "shrink-0 text-[13px]",
                    isLast ? "font-medium text-ink" : "text-muted",
                  )}
                >
                  {who}
                </span>
                {stamp && (
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    {stamp}
                  </span>
                )}
                {!isOpen && (
                  <span className="min-w-0 truncate text-[13px] text-faint">
                    {m.body.replace(/\s+/g, " ").slice(0, 90)}
                  </span>
                )}
              </button>
              {isOpen && (
                <div className="mt-1.5 pl-5">
                  <div className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {m.body || (
                      <span className="italic text-faint">
                        (no text content)
                      </span>
                    )}
                  </div>
                  {m.truncated && (
                    <p className="mt-1 font-mono text-[11px] text-faint">
                      …trimmed — Open thread in Gmail for the full text.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ── Send-time follow-up ───────────────────────────────────────────────── */

/**
 * The "follow up if no reply" fields inside the Send dialogs. Unticked by
 * default; ticking schedules one follow-up on the thread (back-and-forth on
 * the same thread refreshes it rather than stacking duplicates).
 */
function FollowUpFields({
  checked,
  days,
  onCheckedChange,
  onDaysChange,
}: {
  checked: boolean;
  days: number;
  onCheckedChange: (next: boolean) => void;
  onDaysChange: (next: number) => void;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-4 accent-(--green)"
        />
        Follow up if no reply
      </label>
      <select
        value={days}
        disabled={!checked}
        onChange={(e) => onDaysChange(Number(e.target.value))}
        aria-label="Follow-up due in"
        className="h-8 rounded-lg border border-hairline-strong bg-surface px-2 text-[13px] disabled:opacity-45"
      >
        <option value={3}>in 3 days</option>
        <option value={5}>in 5 days</option>
        <option value={7}>in 1 week</option>
        <option value={14}>in 2 weeks</option>
      </select>
    </div>
  );
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function DecisionRow({ item, ctx }: { item: DecisionItem; ctx?: RowCtx }) {
  const completed = useCompleted();
  const done = completed.get(`item:${item.id}`);
  const [checked, setChecked] = useState<boolean[]>(() =>
    item.files.map(() => true),
  );
  const action = useRowAction();

  const mark = (label: string) =>
    completed.mark({
      key: `item:${item.id}`,
      label,
      section: ctx?.section,
      groupKey: ctx?.group.key,
      groupIndex: ctx?.groupIndex,
      rowIndex: ctx?.rowIndex,
      decision: item,
      group: ctx?.group,
    });

  const post = (verb: string, label: string, body?: unknown) =>
    action.mutate(
      { path: `/api/items/${item.id}/${verb}`, body },
      {
        onSuccess: () => mark(label),
        onError: (e) => {
          // Handled elsewhere (digest, another tab) — settle in place.
          if (e instanceof ApiError && (e.status === 409 || e.status === 404))
            mark("Done");
        },
      },
    );

  const fileable = item.real_approval && !item.unplaced;

  return (
    <Row done={!!done}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.type_label}</Badge>
        {item.project && (
          <span className="font-mono text-[11px] text-faint">{item.project}</span>
        )}
      </div>
      <p className="mt-1.5 leading-snug">{item.summary}</p>
      {item.tier_flag && <WarnLine>{item.tier_flag}</WarnLine>}

      {fileable && item.files.length > 0 && (
        <ul
          className={clsx(
            "mt-3 space-y-1.5 rounded-lg bg-paper p-3",
            done && "pointer-events-none",
          )}
        >
          {item.files.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={checked[i] ?? true}
                disabled={!!done}
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

      {done ? (
        <CompletedMark label={done.label} />
      ) : (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {fileable ? (
          <>
            <ActionButton
              variant="primary"
              busy={action.isPending}
              aria-label={`File selected documents: ${item.summary}`}
              onClick={() =>
                post("approve", "Filed", {
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
              onConfirm={() => post("send_admin", "Sent to admin")}
            />
            <ConfirmButton
              label="Reject"
              confirmLabel="Confirm reject"
              variant="danger"
              busy={action.isPending}
              ariaLabel={`Reject: ${item.summary}`}
              onConfirm={() => post("reject", "Rejected")}
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
              onConfirm={() => post("send_admin", "Sent to admin")}
            />
            <ConfirmButton
              label="Reject"
              confirmLabel="Confirm reject"
              variant="danger"
              busy={action.isPending}
              ariaLabel={`Reject: ${item.summary}`}
              onConfirm={() => post("reject", "Rejected")}
            />
          </>
        ) : (
          <ActionButton
            variant="primary"
            busy={action.isPending}
            aria-label={`Mark handled: ${item.summary}`}
            onClick={() => post("approve", "Done")}
          >
            Done
          </ActionButton>
        )}
      </div>
      )}
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

/**
 * The recipient-autocomplete corpus (internal team, sender directory, real
 * correspondence). Fetched on first edit, then cached for the session —
 * every RecipientInput shares one query.
 */
function useContacts(enabled: boolean) {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: () => api<ContactSuggestion[]>("/api/contacts"),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    enabled,
  });
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
  sending,
  onSend,
  onEditingChange,
}: {
  item: DraftItem;
  sending: boolean;
  onSend: (body: DraftSendBody) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveSendOpen, setSaveSendOpen] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(3);
  const [form, setForm] = useState<{
    to: string[];
    cc: string[];
    subject: string;
    body: string;
  }>({ to: [], cc: [], subject: "", body: "" });
  const toast = useToast();
  const queryClient = useQueryClient();
  const contacts = useContacts(editing);

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
      to: form.to,
      cc: form.cc,
      subject: form.subject,
      body: form.body,
    };
  }

  function startEdit() {
    if (!c) return;
    setForm({ to: c.to, cc: c.cc, subject: c.subject, body: c.body });
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
              <RecipientInput
                label="To"
                value={form.to}
                onChange={(to) => setForm((f) => ({ ...f, to }))}
                suggestions={contacts.data ?? []}
                placeholder="Type a name or address…"
              />
              <RecipientInput
                label="Cc"
                value={form.cc}
                onChange={(cc) => setForm((f) => ({ ...f, cc }))}
                suggestions={contacts.data ?? []}
                placeholder="optional"
              />
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
                    disabled={save.isPending || sending}
                    aria-label="Cancel editing"
                    onClick={() => updateEditing(false)}
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    variant={c.sendable ? "quiet" : "primary"}
                    busy={save.isPending}
                    disabled={sending}
                    aria-label={`Save draft to Gmail: ${item.summary}`}
                    onClick={() => save.mutate(formPayload())}
                  >
                    Save to Gmail
                  </ActionButton>
                  {c.sendable && (
                    <ActionButton
                      variant="primary"
                      busy={save.isPending || sending}
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
          onSend({ follow_up: followUp, follow_up_days: followUpDays });
        }}
      >
        <MetaLine label="To" value={form.to.join(", ")} />
        <MetaLine label="Cc" value={form.cc.join(", ")} />
        <MetaLine label="Subj" value={form.subject} />
        <FollowUpFields
          checked={followUp}
          days={followUpDays}
          onCheckedChange={setFollowUp}
          onDaysChange={setFollowUpDays}
        />
        <p className="pt-1 text-[12px] leading-snug text-muted">
          Saves your edits to the Gmail draft first, then sends.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export function DraftRow({ item, ctx }: { item: DraftItem; ctx?: RowCtx }) {
  const completed = useCompleted();
  const done = completed.get(`item:${item.id}`);
  const [editing, setEditing] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(3);
  const action = useRowAction();
  const queryClient = useQueryClient();
  const content = useDraftContent(item);
  const c = content.data;
  const send = useRowAction();

  const mark = (label: string) =>
    completed.mark({
      key: `item:${item.id}`,
      label,
      section: ctx?.section,
      groupKey: ctx?.group.key,
      groupIndex: ctx?.groupIndex,
      rowIndex: ctx?.rowIndex,
      draft: item,
      group: ctx?.group,
    });

  const settle = (e: unknown, label: string) => {
    if (e instanceof ApiError && (e.status === 409 || e.status === 404))
      mark(label);
  };

  const fireSend = (body: DraftSendBody) =>
    send.mutate(
      { path: `/api/drafts/${item.id}/send`, body },
      {
        onSuccess: () => {
          // The draft is gone from Gmail — drop its cached content.
          queryClient.removeQueries({ queryKey: ["draft-content", item.id] });
          mark("Sent");
        },
        onError: (e) => settle(e, "Sent"),
      },
    );

  // Hidden while the edit form is open: the saved draft on Gmail may lag the
  // unsaved edits on screen — "Save & send" in the form covers that path.
  const showSend = !!c?.sendable && !editing && !done;

  return (
    <Row done={!!done}>
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

      {item.open_label === "Open draft" && !done && (
        <DraftPreview
          item={item}
          sending={send.isPending}
          onSend={fireSend}
          onEditingChange={setEditing}
        />
      )}

      {done ? (
        <CompletedMark label={done.label} />
      ) : (
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
            onClick={() =>
              action.mutate(
                { path: `/api/drafts/${item.id}/done` },
                {
                  onSuccess: () => mark("Done"),
                  onError: (e) => settle(e, "Done"),
                },
              )
            }
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
      )}

      <ConfirmDialog
        open={sendOpen}
        title="Send this draft?"
        confirmLabel="Send now"
        onClose={() => setSendOpen(false)}
        onConfirm={() => {
          setSendOpen(false);
          fireSend({ follow_up: followUp, follow_up_days: followUpDays });
        }}
      >
        {c && (
          <>
            <MetaLine label="To" value={c.to.join(", ")} />
            <MetaLine label="Cc" value={c.cc.join(", ")} />
            <MetaLine label="Subj" value={c.subject} />
          </>
        )}
        <FollowUpFields
          checked={followUp}
          days={followUpDays}
          onCheckedChange={setFollowUp}
          onDaysChange={setFollowUpDays}
        />
        <p className="pt-1 text-[12px] leading-snug text-muted">
          Goes out exactly as staged in Gmail.
        </p>
      </ConfirmDialog>
    </Row>
  );
}

/* ── Thread group card (decisions + drafts) ────────────────────────────── */

export function ThreadGroupCard({
  group,
  section,
  groupIndex,
  draftsAlsoListed = false,
}: {
  group: ThreadGroup;
  section: Section;
  groupIndex: number;
  draftsAlsoListed?: boolean;
}) {
  const completed = useCompleted();
  const count = group.decisions.length + group.drafts.length;
  const noun =
    group.decisions.length > 0 && group.drafts.length > 0
      ? "item"
      : group.decisions.length > 0
        ? "action"
        : "draft";
  const allDone =
    count > 0 &&
    [...group.decisions, ...group.drafts].every((i) =>
      completed.get(`item:${i.id}`),
    );
  const [emailOpen, setEmailOpen] = useState(false);
  // One reading panel per card: the whole thread when we know its Gmail id,
  // else the most recently received trigger email.
  const source = [...group.decisions, ...group.drafts]
    .filter((i) => i.message_id)
    .sort((a, b) =>
      (b.received_at ?? "").localeCompare(a.received_at ?? ""),
    )[0];
  const prefetchEmail = useEmailPrefetch(source?.message_id);
  const prefetchThread = useThreadPrefetch(group.thread_id);
  const hasThread = !!group.thread_id;
  const prefetch = hasThread ? prefetchThread : prefetchEmail;
  const canRead = hasThread || !!source?.message_id;

  const ctx = (rowIndex: number): RowCtx => ({
    section,
    group,
    groupIndex,
    rowIndex,
  });

  return (
    <section
      className={clsx(
        "rounded-xl border border-hairline bg-surface px-5 pb-1 pt-4 shadow-[0_1px_2px_rgba(20,18,10,0.04)]",
        allDone && "row-done",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline pb-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium leading-tight">
            {group.subject}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-muted">
            {(group.senders[0] || group.projects[0]) && (
              <span className="min-w-0 truncate">
                {[
                  group.senders[0] &&
                    `From: ${group.senders[0]}${group.senders.length > 1 ? ` +${group.senders.length - 1} more` : ""}`,
                  group.projects[0] &&
                    `Project: ${group.projects[0]}${group.projects.length > 1 ? ` +${group.projects.length - 1} more` : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
            <ReceivedStamp iso={source?.received_at ?? null} />
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {allDone ? (
            <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-green">
              <Check className="size-3.5" />
              All handled
            </span>
          ) : (
            <span className="font-mono text-[11px] text-faint">
              {count} {count === 1 ? noun : `${noun}s`}
            </span>
          )}
          {canRead && (
            <button
              type="button"
              onClick={() => setEmailOpen((o) => !o)}
              onPointerEnter={prefetch}
              onFocus={prefetch}
              aria-expanded={emailOpen}
              aria-label={
                hasThread
                  ? `View thread: ${group.subject}`
                  : `Read latest email: ${group.subject}`
              }
              className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-green transition-colors hover:text-green-deep"
            >
              <ChevronRight
                className={clsx(
                  "size-3.5 transition-transform",
                  emailOpen && "rotate-90",
                )}
              />
              {hasThread ? "View thread" : "Read email"}
            </button>
          )}
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
      {emailOpen && canRead && (
        <div className="border-b border-hairline py-3">
          {hasThread ? (
            <ThreadPanel threadId={group.thread_id} />
          ) : (
            <EmailBodyPanel messageId={source!.message_id!} />
          )}
        </div>
      )}
      <div role="list">
        {group.decisions.map((d, i) => (
          <DecisionRow key={d.id} item={d} ctx={ctx(i)} />
        ))}
        {group.drafts.map((d, i) => (
          <DraftRow key={d.id} item={d} ctx={ctx(i)} />
        ))}
      </div>
      {draftsAlsoListed && group.drafts.length > 0 && (
        <p className="border-t border-hairline py-2.5 font-mono text-[11px] text-faint">
          drafts on this thread also appear in Drafts below
        </p>
      )}
    </section>
  );
}

/* ── Follow-ups ────────────────────────────────────────────────────────── */

export function ReminderRow({ item }: { item: ReminderItem }) {
  const completed = useCompleted();
  const done = completed.get(`reminder:${item.id}`);
  const [days, setDays] = useState(3);
  const action = useRowAction();

  const mark = (label: string) =>
    completed.mark({ key: `reminder:${item.id}`, label });

  const label = item.subject || item.note;

  return (
    <Row done={!!done}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* The email is the headline; the note says what Peter owes it. */}
          {item.subject ? (
            <>
              <p className="font-medium leading-snug">{item.subject}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">
                {item.note}
              </p>
            </>
          ) : (
            <p className="leading-snug">{item.note}</p>
          )}
          {item.sender && (
            <p className="mt-0.5 text-[13px] text-muted">{item.sender}</p>
          )}
          <p
            className={clsx(
              "mt-1 font-mono text-xs",
              item.overdue ? "font-medium text-red" : "text-faint",
            )}
          >
            {item.project && `${item.project} · `}
            due {item.due_at ? item.due_at.slice(0, 10) : "—"}
            {item.overdue && " · overdue"}
          </p>
        </div>
        {done ? (
          <span
            role="status"
            aria-live="polite"
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-medium text-green lg:min-h-9"
          >
            <Check className="size-4" />
            {done.label}
          </span>
        ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {item.open_url && (
            <OpenLink
              href={item.open_url}
              ariaLabel={`Open thread: ${label} (opens Gmail)`}
            >
              Open thread
              <ExternalLink className="ml-1.5 size-3.5 text-faint" />
            </OpenLink>
          )}
          <ActionButton
            variant="primary"
            busy={action.isPending}
            aria-label={`Mark follow-up done: ${label}`}
            onClick={() =>
              action.mutate(
                { path: `/api/reminders/${item.id}/done` },
                { onSuccess: () => mark("Done") },
              )
            }
          >
            Done
          </ActionButton>
          <span className="inline-flex items-center gap-1.5">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label={`Snooze duration for: ${label}`}
              className="h-11 rounded-lg border border-hairline-strong bg-surface px-2 text-sm lg:h-9"
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>1 week</option>
            </select>
            <ActionButton
              variant="admin"
              busy={action.isPending}
              aria-label={`Snooze follow-up: ${label}`}
              onClick={() =>
                action.mutate(
                  {
                    path: `/api/reminders/${item.id}/snooze`,
                    body: { days },
                  },
                  { onSuccess: () => mark("Snoozed") },
                )
              }
            >
              Snooze
            </ActionButton>
          </span>
        </div>
        )}
      </div>
    </Row>
  );
}

/* ── FYI ───────────────────────────────────────────────────────────────── */

export function FyiRow({ item }: { item: FyiItem }) {
  const completed = useCompleted();
  const done = completed.get(`fyi:${item.message_id}`);
  const action = useRowAction();

  const mark = () =>
    completed.mark({ key: `fyi:${item.message_id}`, label: "Dismissed" });

  return (
    <Row done={!!done}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{item.subject}</p>
          {(item.sender || item.received_at) && (
            <p className="mt-0.5 text-[13px] text-muted">
              {item.sender}
              {item.sender && item.received_at ? " · " : ""}
              {item.received_at && (
                <span className="font-mono text-[11px] text-faint">
                  {formatReceived(item.received_at)}
                </span>
              )}
            </p>
          )}
          {item.gist && (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {item.gist}
            </p>
          )}
          <EmailPeek
            messageId={item.message_id}
            subject={item.subject}
            label="Read full email"
          />
        </div>
        {done ? (
          <span
            role="status"
            aria-live="polite"
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-medium text-green lg:min-h-9"
          >
            <Check className="size-4" />
            {done.label}
          </span>
        ) : (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <OpenLink
              href={item.open_url}
              ariaLabel={`Open FYI email: ${item.subject} (opens Gmail)`}
            >
              Open email
              <ExternalLink className="ml-1.5 size-3.5 text-faint" />
            </OpenLink>
            <ActionButton
              variant="admin"
              busy={action.isPending}
              aria-label={`Dismiss FYI: ${item.subject}`}
              onClick={() =>
                action.mutate(
                  {
                    path: "/api/fyi/dismiss",
                    body: { message_id: item.message_id },
                  },
                  { onSuccess: mark },
                )
              }
            >
              <X className="size-3.5" />
              Dismiss
            </ActionButton>
          </div>
        )}
      </div>
    </Row>
  );
}

/* ── Security ──────────────────────────────────────────────────────────── */

export function SecurityRow({ item }: { item: SecurityItem }) {
  const completed = useCompleted();
  const done = completed.get(`security:${item.message_id}`);
  const action = useRowAction();

  return (
    <Row done={!!done}>
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
        {done ? (
          <span
            role="status"
            aria-live="polite"
            className="flex min-h-11 shrink-0 items-center gap-1.5 text-[13px] font-medium text-green lg:min-h-9"
          >
            <Check className="size-4" />
            {done.label}
          </span>
        ) : (
          <ActionButton
            variant="admin"
            busy={action.isPending}
            aria-label={`Dismiss security alert: ${item.subject}`}
            onClick={() =>
              action.mutate(
                {
                  path: "/api/security/dismiss",
                  body: { message_id: item.message_id },
                },
                {
                  onSuccess: () =>
                    completed.mark({
                      key: `security:${item.message_id}`,
                      label: "Dismissed",
                    }),
                },
              )
            }
          >
            Dismiss
          </ActionButton>
        )}
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
