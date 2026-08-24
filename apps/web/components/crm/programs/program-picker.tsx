"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPrograms } from "@/lib/programs/api";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { Input } from "@/components/ui/input";

/// Search-as-you-type picker for `programId` fields (UniversityChoice/Application creation).
/// Unlike `StudentPicker`/`UserPicker`, no manual-UUID fallback is needed — every role that
/// can create a University Choice or Application also holds `admission_master:view` (GLOBAL
/// catalog, no per-record scope — docs/frontend/FRONTEND_PERMISSION_MAP.md), so the search
/// path is always reachable.
export function ProgramPicker({ value, onChange, label }: { value: string; onChange: (programId: string) => void; label: string }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const inputId = useId();

  const { data, isLoading } = useQuery({
    queryKey: ["programs", "picker", debouncedSearch],
    queryFn: () => listPrograms({ search: debouncedSearch || undefined, limit: 10 }),
  });

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input id={inputId} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo ngành, trường..." />
      <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border">
        {isLoading ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Đang tìm...</p>
        ) : data && data.data.length > 0 ? (
          <ul>
            {data.data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${value === p.id ? "bg-muted font-medium" : ""}`}
                >
                  {p.degreeLevel} · {p.major} — {p.university.officialName} ({p.university.countryCode})
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy.</p>
        )}
      </div>
      {value ? <p className="mt-1 text-xs text-muted-foreground">Đã chọn: {value}</p> : null}
    </div>
  );
}
