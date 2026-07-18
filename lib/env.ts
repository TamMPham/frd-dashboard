// DEV ONLY escape hatch: when set (with the backend's DEV_AUTH_BYPASS_EMAIL),
// the app skips Supabase login so the stack can run before the Google
// provider is configured. Never enable in production.
export const DEV_AUTH_BYPASS =
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "1";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Supabase publishable key (sb_publishable_...) — the modern replacement for
// the legacy anon JWT key. Safe to ship to the browser.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY,
);
