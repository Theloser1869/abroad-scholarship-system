"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listScholarshipMasters } from "@/lib/scholarship-masters/api";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { Input } from "@/components/ui/input";

/// Search-as-you-type picker for `scholarshipMasterId` (ScholarshipApplication creation).
/// Same reasoning as `ProgramPicker` — no manual-UUID fallback needed, every role that can
/// create a ScholarshipApplication also holds `admission_master:view`.
export function ScholarshipMasterPicker({ value, onChange, label }: { value: string; onChange: (scholarshipMasterId: string) => void; label: string }) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const inputId = useId();

  const { data, isLoading } = useQuery({
    queryKey: ["scholarship-masters", "picker", debouncedSearch],
    queryFn: () => listScholarshipMasters({ search: debouncedSearch || undefined, limit: 10 }),
  });

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input id={inputId} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên học bổng, đơn vị cấp..." />
      <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border">
        {isLoading ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Đang tìm...</p>
        ) : data && data.data.length > 0 ? (
          <ul>
            {data.data.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onChange(s.id)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${value === s.id ? "bg-muted font-medium" : ""}`}
                >
                  {s.name} — {s.provider}
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
