"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { listStudents } from "@/lib/students/api";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { Input } from "@/components/ui/input";

/// Same pattern as `UserPicker` (F03) — `GET /students` is `students:view`-gated, and
/// ADMIN_FINANCE (the role that actually creates Contracts day-to-day) holds zero `students`
/// grant at all (docs/frontend/FRONTEND_PERMISSION_MAP.md — Contract/Payment scope is
/// deliberately separate from Student/Case scope). Degrades to a manual UUID input for any
/// role without `students:view`, documented limitation, never a workaround calling a
/// different endpoint.
export function StudentPicker({ value, onChange, label }: { value: string; onChange: (studentId: string) => void; label: string }) {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const canBrowseStudents = can("students", "view");
  const inputId = useId();

  const { data, isLoading } = useQuery({
    queryKey: ["students", "picker", debouncedSearch],
    queryFn: () => listStudents({ search: debouncedSearch || undefined, limit: 10 }),
    enabled: canBrowseStudents,
  });

  if (!canBrowseStudents) {
    return (
      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          {label} (Student ID)
        </label>
        <Input id={inputId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID học sinh" required />
        <p className="mt-1 text-xs text-muted-foreground">
          Tài khoản của bạn không có quyền tra cứu danh sách học sinh — nhập trực tiếp Student ID.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input id={inputId} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc mã học sinh..." />
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
                  {s.fullName} ({s.studentCode})
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
