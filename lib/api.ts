"use client";

import { DEV_AUTH_BYPASS, SUPABASE_CONFIGURED } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/client";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Same-origin fetch with the Supabase access token attached. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  if (!DEV_AUTH_BYPASS && SUPABASE_CONFIGURED) {
    const { data } = await getBrowserSupabase().auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      body && typeof body.detail === "string"
        ? body.detail
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return body as T;
}
