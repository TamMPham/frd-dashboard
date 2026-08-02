"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import type { ContactSuggestion } from "@/lib/types";

/**
 * Gmail-style recipient field: committed addresses render as removable chips,
 * free typing filters the contacts corpus into a keyboard-navigable dropdown
 * (↑↓ + Enter), and comma/semicolon/blur commit a hand-typed address. Peter
 * doesn't remember addresses — the suggestions do.
 */
export function RecipientInput({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: ContactSuggestion[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const byEmail = useMemo(() => {
    const map = new Map<string, ContactSuggestion>();
    for (const s of suggestions) map.set(s.email, s);
    return map;
  }, [suggestions]);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const committed = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter(
        (s) =>
          !committed.has(s.email) &&
          (s.email.includes(q) || s.name.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [text, suggestions, value]);

  const showList = open && filtered.length > 0;

  function commit(address: string) {
    const email = address.trim().replace(/[,;]+$/, "");
    if (!email || !email.includes("@")) return false;
    if (!value.some((v) => v.toLowerCase() === email.toLowerCase())) {
      onChange([...value, email]);
    }
    setText("");
    setHighlight(0);
    return true;
  }

  function commitFreeText() {
    if (text.trim() && commit(text)) return true;
    return false;
  }

  function remove(email: string) {
    onChange(value.filter((v) => v !== email));
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && filtered.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp" && filtered.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showList && filtered[highlight]) commit(filtered[highlight].email);
      else commitFreeText();
    } else if (e.key === "," || e.key === ";") {
      e.preventDefault();
      commitFreeText();
    } else if (e.key === "Backspace" && text === "" && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (!/[,;\s]/.test(pasted.trim())) return; // single token: type normally
    e.preventDefault();
    let next = [...value];
    for (const token of pasted.split(/[,;\s]+/)) {
      const email = token.trim().replace(/^<|>$/g, "");
      if (
        email.includes("@") &&
        !next.some((v) => v.toLowerCase() === email.toLowerCase())
      ) {
        next = [...next, email];
      }
    }
    onChange(next);
    setText("");
  }

  return (
    <label className="relative block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-faint">
        {label}
      </span>
      <div
        className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-2 py-1.5 transition-colors focus-within:border-green focus-within:ring-1 focus-within:ring-green"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email) => {
          const known = byEmail.get(email.toLowerCase());
          return (
            <span
              key={email}
              title={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-hairline bg-paper py-0.5 pl-2.5 pr-1 text-[12px] leading-5 text-ink"
            >
              <span className="truncate">{known?.name || email}</span>
              <button
                type="button"
                aria-label={`Remove ${email}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(email);
                }}
                className="rounded-full p-0.5 text-faint transition-colors hover:bg-hairline hover:text-ink"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList ? `${listId}-${highlight}` : undefined
          }
          aria-autocomplete="list"
          aria-label={`${label} recipients`}
          className="min-w-28 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-faint"
          value={text}
          placeholder={value.length === 0 ? placeholder : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Dropdown clicks commit on mousedown, before blur fires.
            commitFreeText();
            setOpen(false);
          }}
        />
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-hairline-strong bg-surface shadow-lg"
        >
          {filtered.map((s, i) => (
            <li
              key={s.email}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the input
                commit(s.email);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={clsx(
                "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2",
                i === highlight && "bg-green-tint",
              )}
            >
              <span className="min-w-0">
                {s.name && (
                  <span className="mr-2 text-sm font-medium text-ink">
                    {s.name}
                  </span>
                )}
                <span className="font-mono text-[11px] text-faint">
                  {s.email}
                </span>
              </span>
              {s.source === "internal" && (
                <span className="shrink-0 rounded-full bg-green-tint px-2 font-mono text-[10px] uppercase tracking-wide text-green">
                  team
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
