"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Clock3,
  Info,
  ListChecks,
  LogOut,
  PenLine,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { DEV_AUTH_BYPASS } from "@/lib/env";
import type { ActionResult, DashboardPayload } from "@/lib/types";

import {
  EmptyState,
  FyiRow,
  ReminderRow,
  SecurityRow,
  ThreadGroupCard,
} from "./rows";
import { useToast } from "./toast";

const NAV = [
  { id: "decisions", label: "Decisions", icon: ListChecks },
  { id: "drafts", label: "Drafts", icon: PenLine },
  { id: "follow-ups", label: "Follow-ups", icon: Clock3 },
  { id: "fyi", label: "FYI", icon: Info },
] as const;

function navCount(data: DashboardPayload | undefined, id: string): number {
  if (!data) return 0;
  switch (id) {
    case "decisions":
      return data.totals.decisions;
    case "drafts":
      return data.totals.drafts;
    case "follow-ups":
      return data.totals.reminders;
    case "fyi":
      return data.totals.fyi;
    default:
      return 0;
  }
}

function SectionHeading({
  id,
  title,
  detail,
}: {
  id: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={`${id}-heading`} className="font-display text-2xl font-medium">
        {title}
      </h2>
      <span className="font-mono text-[11px] text-faint">{detail}</span>
    </div>
  );
}

export default function Dashboard({ userEmail }: { userEmail: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data, error, isPending, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardPayload>("/api/dashboard"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useMutation({
    mutationFn: () => api<ActionResult>("/api/refresh", { method: "POST" }),
    onSuccess: (r) => {
      toast(r.message, true);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) =>
      toast(e instanceof ApiError ? e.message : "Refresh failed", false),
  });

  const t = data?.totals;

  const rail = (
    <nav aria-label="Sections" className="space-y-1">
      {NAV.map(({ id, label, icon: Icon }) => {
        const n = navCount(data, id);
        return (
          <a
            key={id}
            href={`#${id}`}
            className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-green-tint hover:text-green"
          >
            <span className="flex items-center gap-2.5">
              <Icon className="size-4" />
              {label}
            </span>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 font-mono text-[11px]",
                n > 0
                  ? "bg-green text-white"
                  : "bg-transparent text-faint",
              )}
            >
              {n}
            </span>
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:px-8">
      {/* Desktop rail */}
      <aside className="hidden lg:block">
        <div className="sticky top-0 flex h-screen flex-col py-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            Freedom Road
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">
            Donna
          </h1>
          <div className="mt-8">{rail}</div>
          {(t?.security ?? 0) > 0 && (
            <a
              href="#security"
              className="mt-1 flex items-center gap-2.5 rounded-lg bg-red-tint px-3 py-2 text-sm font-medium text-red"
            >
              <ShieldAlert className="size-4" />
              Security ({t?.security})
            </a>
          )}
          <div className="mt-auto space-y-3 border-t border-hairline pt-4">
            <button
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
              className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-green disabled:opacity-60"
            >
              <RefreshCw
                className={clsx("size-4", refresh.isPending && "animate-spin")}
              />
              Refresh queue
            </button>
            {dataUpdatedAt > 0 && (
              <p className="font-mono text-[11px] text-faint">
                updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </p>
            )}
            {!DEV_AUTH_BYPASS && (
              <form action="/auth/signout" method="post">
                <button className="flex items-center gap-2 text-sm text-faint transition-colors hover:text-ink">
                  <LogOut className="size-4" />
                  {userEmail || "Sign out"}
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-paper/95 px-5 py-3 backdrop-blur lg:hidden">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          Donna
        </h1>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label="Refresh the queue"
          className="rounded-lg p-2 text-muted disabled:opacity-60"
        >
          <RefreshCw
            className={clsx("size-5", refresh.isPending && "animate-spin")}
          />
        </button>
      </header>

      <main className="flex-1 space-y-10 px-5 pb-28 pt-6 lg:px-0 lg:py-8">
        {isPending && (
          <div className="space-y-4" aria-label="Loading">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl border border-hairline bg-surface"
              />
            ))}
          </div>
        )}

        {error && !data && (
          <EmptyState>
            Couldn&apos;t load the queue —{" "}
            {error instanceof ApiError ? error.message : "is the backend running?"}
          </EmptyState>
        )}

        {data && (
          <>
            {data.security.length > 0 && (
              <section
                id="security"
                aria-labelledby="security-heading"
                className="rise rounded-xl border border-red/30 bg-red-tint/60 px-5 py-4"
              >
                <h2
                  id="security-heading"
                  className="flex items-center gap-2 font-display text-2xl font-medium text-red"
                >
                  <ShieldAlert className="size-5" />
                  Security review
                </h2>
                <div role="list">
                  {data.security.map((s) => (
                    <SecurityRow key={s.message_id} item={s} />
                  ))}
                </div>
              </section>
            )}

            <section
              id="decisions"
              aria-labelledby="decisions-heading"
              className="rise space-y-4"
              style={{ animationDelay: "60ms" }}
            >
              <SectionHeading
                id="decisions"
                title="Needs your decision"
                detail={`${data.totals.decisions} action${data.totals.decisions === 1 ? "" : "s"} in ${data.totals.decision_threads} thread${data.totals.decision_threads === 1 ? "" : "s"}`}
              />
              {data.decisions.length > 0 ? (
                data.decisions.map((g) => (
                  <ThreadGroupCard key={g.key} group={g} />
                ))
              ) : (
                <EmptyState>Nothing waiting on a decision. All clear.</EmptyState>
              )}
            </section>

            <section
              id="drafts"
              aria-labelledby="drafts-heading"
              className="rise space-y-4"
              style={{ animationDelay: "120ms" }}
            >
              <SectionHeading
                id="drafts"
                title="Drafts waiting for your Send"
                detail={`${data.totals.drafts} draft${data.totals.drafts === 1 ? "" : "s"} in ${data.totals.draft_threads} thread${data.totals.draft_threads === 1 ? "" : "s"}`}
              />
              {data.drafts.length > 0 ? (
                data.drafts.map((g) => <ThreadGroupCard key={g.key} group={g} />)
              ) : (
                <EmptyState>No drafts waiting.</EmptyState>
              )}
            </section>

            <section
              id="follow-ups"
              aria-labelledby="follow-ups-heading"
              className="rise space-y-4"
              style={{ animationDelay: "180ms" }}
            >
              <SectionHeading
                id="follow-ups"
                title="Follow-ups"
                detail={`${data.totals.reminders}`}
              />
              {data.reminders.length > 0 ? (
                <div
                  role="list"
                  className="rounded-xl border border-hairline bg-surface px-5"
                >
                  {data.reminders.map((r) => (
                    <ReminderRow key={r.id} item={r} />
                  ))}
                </div>
              ) : (
                <EmptyState>No follow-ups due.</EmptyState>
              )}
            </section>

            <section
              id="fyi"
              aria-labelledby="fyi-heading"
              className="rise space-y-4"
              style={{ animationDelay: "240ms" }}
            >
              <SectionHeading
                id="fyi"
                title="FYI — no action needed"
                detail={`${data.totals.fyi} in the last 24h`}
              />
              {data.fyi.length > 0 ? (
                <div
                  role="list"
                  className="rounded-xl border border-hairline bg-surface px-5"
                >
                  {data.fyi.map((f) => (
                    <FyiRow key={f.message_id} item={f} />
                  ))}
                </div>
              ) : (
                <EmptyState>No FYIs in the last 24 hours.</EmptyState>
              )}
            </section>

            {data.counts.length > 0 && (
              <footer className="border-t border-hairline pt-4 font-mono text-[11px] leading-relaxed text-faint">
                Last 24h:{" "}
                {data.counts.map((c) => `${c.k}: ${c.n}`).join(" · ")}
              </footer>
            )}
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-surface/95 backdrop-blur lg:hidden"
      >
        {NAV.map(({ id, label, icon: Icon }) => {
          const n = navCount(data, id);
          return (
            <a
              key={id}
              href={`#${id}`}
              className="relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted"
            >
              <Icon className="size-5" />
              {label}
              {n > 0 && (
                <span className="absolute right-1/2 top-1.5 translate-x-4 rounded-full bg-green px-1.5 font-mono text-[10px] leading-4 text-white">
                  {n}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
