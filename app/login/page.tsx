"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { DEV_AUTH_BYPASS, SUPABASE_CONFIGURED } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3a7.4 7.4 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3.3.6 4.6 1.8L20 3A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-5 6.7-5Z"
      />
    </svg>
  );
}

function LoginCard() {
  const params = useSearchParams();
  const failed = params.get("error") === "auth";
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = getBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="flex-1 grid place-items-center px-6 py-16">
      <div className="rise w-full max-w-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          Freedom Road Developments
        </p>
        <h1 className="mt-2 font-display text-6xl font-medium tracking-tight">
          Donna
        </h1>
        <p className="mt-3 text-muted leading-relaxed">
          Your email queue — decisions, drafts, follow-ups and FYIs — on one
          quiet page.
        </p>

        <div className="mt-10 border-t border-hairline pt-8">
          {DEV_AUTH_BYPASS ? (
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-green px-5 font-medium text-white transition-colors hover:bg-green-deep"
            >
              Open Donna (dev bypass active)
            </Link>
          ) : SUPABASE_CONFIGURED ? (
            <>
              <button
                onClick={signIn}
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-hairline-strong bg-surface px-5 font-medium transition-colors hover:border-green hover:text-green disabled:opacity-60"
              >
                <GoogleMark />
                {busy ? "Opening Google…" : "Continue with Google"}
              </button>
              {failed && (
                <p className="mt-4 text-sm text-red">
                  Sign-in didn&apos;t complete — try again.
                </p>
              )}
              <p className="mt-4 text-xs text-faint leading-relaxed">
                One sign-in, then Donna stays signed in on this device. Access
                is limited to approved accounts.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber leading-relaxed">
              Supabase Auth isn&apos;t configured yet — set
              NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              in .env.local (see .env.local.example).
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
