import { AlertTriangle, ShieldQuestion } from "lucide-react";

import type { TokenPeek } from "@/lib/types";

import TokenConfirm from "./confirm";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 px-5 py-12">
      <div className="mx-auto w-full max-w-lg">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
          Freedom Road Developments
        </p>
        <p className="font-display text-3xl font-medium tracking-tight">
          Donna
        </p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

// The digest email's one-tap links land here. This page render is a pure GET
// peek — mail-link scanners can fetch it freely; the action only happens on
// the confirm POST, which consumes the single-use nonce.
export default async function TokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let peek: TokenPeek | null = null;
  let problem: string | null = null;
  try {
    const res = await fetch(
      `${BACKEND_ORIGIN}/api/t/${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      problem =
        body && typeof body.detail === "string"
          ? body.detail
          : "This link couldn't be verified.";
    } else {
      peek = body as TokenPeek;
    }
  } catch {
    problem = "Donna's backend isn't reachable right now — try again shortly.";
  }

  if (problem || !peek) {
    return (
      <Shell>
        <div className="rise rounded-xl border border-hairline bg-surface p-6">
          <p className="flex items-center gap-2 font-display text-2xl font-medium">
            <ShieldQuestion className="size-6 text-muted" />
            Link problem
          </p>
          <p className="mt-2 leading-relaxed text-muted">{problem}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="rise rounded-xl border border-hairline bg-surface p-6">
        <h1 className="font-display text-2xl font-medium leading-snug">
          {peek.title}
        </h1>

        {peek.warning && (
          <p className="mt-3 flex items-start gap-1.5 text-sm font-medium text-amber">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {peek.warning}
          </p>
        )}

        {peek.rows.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-y border-hairline py-4">
            {peek.rows.map((row) => (
              <div key={row.label} className="flex gap-3 text-sm">
                <dt className="w-24 shrink-0 font-medium text-muted">
                  {row.label}
                </dt>
                <dd className="min-w-0 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {peek.note && (
          <p className="mt-4 text-sm leading-relaxed text-muted">{peek.note}</p>
        )}

        <div className="mt-5">
          <TokenConfirm token={token} peek={peek} />
        </div>
      </div>
    </Shell>
  );
}
