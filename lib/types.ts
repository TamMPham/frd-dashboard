// Mirrors frd-backend/src/frd_backend/schemas.py — keep the two in sync.

export interface SecurityItem {
  message_id: string;
  subject: string | null;
  from_email: string | null;
  reason: string | null;
}

export interface FileEntry {
  name: string;
  dest_path: string | null;
  size_bytes: number | null;
}

export interface DecisionItem {
  id: number;
  type_label: string;
  summary: string;
  tier_flag: string;
  real_approval: boolean;
  unplaced: boolean;
  files: FileEntry[];
  status: string;
  project: string;
  sender: string;
}

export interface DelegationTarget {
  name: string;
  email: string;
  mode_label: string;
}

export interface DraftItem {
  id: number;
  type_label: string;
  summary: string;
  flags: string[];
  review_note: string;
  delegation: DelegationTarget[];
  delegation_missing: boolean;
  open_url: string;
  open_label: "Open draft" | "Open email";
  status: string;
  status_label: string;
}

export interface ThreadGroup {
  key: string;
  subject: string;
  senders: string[];
  projects: string[];
  open_url: string;
  decisions: DecisionItem[];
  drafts: DraftItem[];
}

export interface ReminderItem {
  id: number;
  note: string;
  project: string;
  due_at: string | null;
  overdue: boolean;
}

export interface FyiItem {
  message_id: string;
  subject: string;
  sender: string;
  gist: string;
  open_url: string;
}

export interface CountEntry {
  k: string;
  n: number;
}

export interface Totals {
  security: number;
  decisions: number;
  decision_threads: number;
  drafts: number;
  draft_threads: number;
  reminders: number;
  fyi: number;
}

export interface DashboardPayload {
  security: SecurityItem[];
  decisions: ThreadGroup[];
  drafts: ThreadGroup[];
  reminders: ReminderItem[];
  fyi: FyiItem[];
  counts: CountEntry[];
  totals: Totals;
  generated_at: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

// ── Token flow ──────────────────────────────────────────────────────────────

export interface KV {
  label: string;
  value: string;
}

export interface TokenFile {
  name: string;
  size_kb: number | null;
  dest_path: string | null;
}

export interface TokenPeek {
  kind: "action" | "draft" | "reminder";
  verb: string;
  id: number;
  title: string;
  confirm_label: string;
  rows: KV[];
  warning: string;
  note: string;
  files: TokenFile[];
  select_files: boolean;
  sends_to: string;
  snooze_choices: number[];
}

export interface TokenResult {
  ok: boolean;
  title: string;
  message: string;
}
