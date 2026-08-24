"use client";

import { Input } from "./input";
import { cn } from "@/lib/utils/cn";

/// F09 UX hardening (instruction §12 "clear search") — the same debounced-search `<Input>`
/// pattern was duplicated across 7 list pages (Leads/Students/Partners/Programs/Scholarship
/// masters/Universities/Visa checklist templates), none of them offering a reliable way to
/// clear the field beyond manually selecting and deleting the text. A custom clear (✕) button
/// is used instead of relying on `type="search"`'s native browser affordance alone — that
/// native control is inconsistent (Chrome/Edge/Safari show one, Firefox does not) — and the
/// native one is hidden via `[&::-webkit-search-cancel-button]:hidden` so only ONE clear
/// control ever appears, never two stacked on top of each other in WebKit browsers.
export function SearchInput({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label": string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label="Xóa tìm kiếm"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
