"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { DecisionItem, DraftItem, ThreadGroup } from "@/lib/types";

/**
 * The recently-completed set: rows Peter has acted on stay rendered at full
 * height as greyed "✓ done" tombstones, so the list never shifts under his
 * cursor. When a poll drops a completed item from the payload, its snapshot
 * is re-injected at the remembered position; tombstones clear on the manual
 * Refresh, on section navigation, or after a 5-minute TTL.
 */

const TTL_MS = 5 * 60_000;

export type Section = "decisions" | "drafts";

export interface CompletedEntry {
  key: string; // "item:7" | "reminder:3" | "fyi:m-1" | "security:m-2"
  label: string; // "Filed" | "Sent" | "Done" | "Rejected" | "Dismissed" | …
  at: number;
  // Thread-section rows carry snapshots so mergeCompleted can re-inject them
  // after a refetch; flat sections (follow-ups/FYI/security) tombstone in
  // place only and simply drop off on a post-TTL poll.
  section?: Section;
  groupKey?: string;
  groupIndex?: number;
  rowIndex?: number;
  decision?: DecisionItem;
  draft?: DraftItem;
  group?: ThreadGroup; // card snapshot for ghost groups
}

interface CompletedApi {
  mark: (entry: Omit<CompletedEntry, "at">) => void;
  get: (key: string) => CompletedEntry | undefined;
  clear: () => void;
  entries: CompletedEntry[];
}

const CompletedContext = createContext<CompletedApi>({
  mark: () => {},
  get: () => undefined,
  clear: () => {},
  entries: [],
});

export function useCompleted(): CompletedApi {
  return useContext(CompletedContext);
}

export function CompletedProvider({ children }: { children: React.ReactNode }) {
  const [map, setMap] = useState<Map<string, CompletedEntry>>(new Map());

  const mark = useCallback((entry: Omit<CompletedEntry, "at">) => {
    setMap((prev) => {
      const next = new Map(prev);
      next.set(entry.key, { ...entry, at: Date.now() });
      return next;
    });
  }, []);

  const get = useCallback((key: string) => map.get(key), [map]);

  const clear = useCallback(() => setMap(new Map()), []);

  // TTL prune so stale tombstones don't pin the layout forever.
  useEffect(() => {
    const tick = setInterval(() => {
      setMap((prev) => {
        const cutoff = Date.now() - TTL_MS;
        if (![...prev.values()].some((e) => e.at < cutoff)) return prev;
        return new Map([...prev].filter(([, e]) => e.at >= cutoff));
      });
    }, 30_000);
    return () => clearInterval(tick);
  }, []);

  const api = useMemo<CompletedApi>(
    () => ({ mark, get, clear, entries: [...map.values()] }),
    [mark, get, clear, map],
  );

  return (
    <CompletedContext.Provider value={api}>
      {children}
    </CompletedContext.Provider>
  );
}

function insertAt<T>(list: T[], index: number | undefined, value: T): T[] {
  const at = Math.min(index ?? list.length, list.length);
  return [...list.slice(0, at), value, ...list.slice(at)];
}

/**
 * Re-inject completed snapshots into a fresh payload so the layout Peter was
 * looking at stays put:
 * - a completed row missing from a live group is restored at its old index;
 * - a card whose every item was handled comes back as a ghost group showing
 *   only the tombstoned rows.
 */
export function mergeCompleted(
  section: Section,
  live: ThreadGroup[],
  entries: CompletedEntry[],
): ThreadGroup[] {
  if (entries.length === 0) return live;

  // Any completed snapshot re-attaches wherever its group still renders —
  // a draft acted on inside a decisions card must also hold its place in the
  // Drafts section's copy of the same thread.
  const merged = live.map((group) => {
    const mine = entries.filter(
      (e) => e.groupKey === group.key && (e.decision || e.draft),
    );
    if (mine.length === 0) return group;
    let decisions = group.decisions;
    let drafts = group.drafts;
    for (const e of mine) {
      if (e.decision && !decisions.some((d) => d.id === e.decision!.id)) {
        decisions = insertAt(decisions, e.rowIndex, e.decision);
      }
      if (e.draft && !drafts.some((d) => d.id === e.draft!.id)) {
        drafts = insertAt(drafts, e.rowIndex, e.draft);
      }
    }
    if (decisions === group.decisions && drafts === group.drafts) return group;
    return { ...group, decisions, drafts };
  });

  // Ghost groups: the whole card vanished from this section's payload.
  const liveKeys = new Set(merged.map((g) => g.key));
  const ghosts = new Map<string, { index: number; group: ThreadGroup }>();
  for (const e of entries) {
    if (e.section !== section || !e.group || !e.groupKey) continue;
    if (liveKeys.has(e.groupKey) || ghosts.has(e.groupKey)) continue;
    const completedKeys = new Set(
      entries.filter((x) => x.groupKey === e.groupKey).map((x) => x.key),
    );
    const ghost: ThreadGroup = {
      ...e.group,
      decisions: e.group.decisions.filter((d) =>
        completedKeys.has(`item:${d.id}`),
      ),
      drafts: e.group.drafts.filter((d) => completedKeys.has(`item:${d.id}`)),
    };
    if (ghost.decisions.length + ghost.drafts.length > 0) {
      ghosts.set(e.groupKey, { index: e.groupIndex ?? merged.length, group: ghost });
    }
  }
  let out = merged;
  for (const { index, group } of [...ghosts.values()].sort(
    (a, b) => a.index - b.index,
  )) {
    out = insertAt(out, index, group);
  }
  return out;
}
