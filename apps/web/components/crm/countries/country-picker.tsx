"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { COUNTRIES, findCountryByCode } from "@/lib/countries/data";

/// Search-as-you-type country picker — staff type/browse a Vietnamese or English country name
/// instead of memorizing ISO-2 codes; the underlying field (Lead.countryInterest,
/// Student.targetCountry, Visa.countryCode, ...) still stores the 2-letter code, so no backend
/// change was needed to adopt this. Modeled on `SchoolPicker`'s open/close-on-blur pattern,
/// simplified since the country list is a fixed local set (no search API, no "add new").
export function CountryPicker({
  value,
  onChange,
  label,
  required,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  required?: boolean;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(() => findCountryByCode(value)?.nameVi ?? value ?? "");
  const [open, setOpen] = useState(false);

  // Re-sync the display text with `value` whenever it (or `open`, on close) changes —
  // adjusted during render rather than in an effect (react-hooks/set-state-in-effect;
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // so this never costs an extra commit/paint before catching up.
  const [prevValue, setPrevValue] = useState(value);
  const [prevOpen, setPrevOpen] = useState(open);
  if (value !== prevValue || open !== prevOpen) {
    setPrevValue(value);
    setPrevOpen(open);
    if (!open) setQuery(findCountryByCode(value)?.nameVi ?? value ?? "");
  }

  const q = query.trim().toLowerCase();
  const results = q
    ? COUNTRIES.filter((c) => c.nameVi.toLowerCase().includes(q) || c.nameEn.toLowerCase().includes(q) || c.code.toLowerCase() === q)
    : COUNTRIES;

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input
        id={inputId}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Tìm theo tên quốc gia..."
        required={required}
        autoComplete="off"
      />
      {open ? (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-background shadow-sm">
          {results.length > 0 ? (
            <ul>
              {results.slice(0, 50).map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(c.code);
                      setQuery(c.nameVi);
                      setOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${value === c.code ? "bg-muted font-medium" : ""}`}
                  >
                    {c.nameVi}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy quốc gia phù hợp.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
