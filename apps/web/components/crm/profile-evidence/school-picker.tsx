"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createSchoolMaster, listSchoolMasters } from "@/lib/school-masters/api";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { crmErrorMessage } from "@/lib/api/error-messages";

/// Client Acceptance Remediation DEC-05(b) (2026-08-27) — "ưu tiên School Master, cho phép
/// nhập trường chưa có." Modeled directly on `ProgramPicker`
/// (`components/crm/programs/program-picker.tsx`): same debounced search-then-pick pattern.
/// Two differences: (1) typing with no match is itself a valid value — `schoolMasterId`
/// stays null and the typed text becomes `school` directly; (2) when nothing matches and the
/// caller holds `school_master:create`, an inline "+ Thêm trường mới" button adds it to the
/// master list right there, no separate admin page.
export function SchoolPicker({
  school,
  schoolMasterId,
  onChange,
  label = "Trường",
}: {
  school: string;
  schoolMasterId: string | null;
  onChange: (school: string, schoolMasterId: string | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const debouncedSchool = useDebouncedValue(school, 300);
  const { can } = usePermissions();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["school-masters", "picker", debouncedSchool],
    queryFn: () => listSchoolMasters(debouncedSchool || undefined),
    enabled: open && debouncedSchool.trim().length > 0,
  });

  const exactMatch = data?.some((s) => s.name.toLowerCase() === school.trim().toLowerCase());

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await createSchoolMaster({ name: school.trim() });
      onChange(created.name, created.id);
      setOpen(false);
    } catch (err) {
      toast({ title: "Không thêm được trường mới", description: crmErrorMessage(err), variant: "danger" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor="academic-school" className="mb-1 block text-sm font-medium">
        {label} *
      </label>
      <Input
        id="academic-school"
        value={school}
        onChange={(e) => {
          onChange(e.target.value, null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        required
      />
      {schoolMasterId ? <p className="mt-1 text-xs text-muted-foreground">Đã chọn từ danh sách trường.</p> : null}
      {open && debouncedSchool.trim().length > 0 ? (
        <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-border bg-background shadow-sm">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Đang tìm...</p>
          ) : data && data.length > 0 ? (
            <ul>
              {data.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(s.name, s.id);
                      setOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${schoolMasterId === s.id ? "bg-muted font-medium" : ""}`}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy trong danh sách — sẽ lưu dưới dạng nhập tự do.</p>
          )}
          {!exactMatch && can("school_master", "create") ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              disabled={creating}
              className="block w-full border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-muted"
            >
              {creating ? "Đang thêm..." : `+ Thêm trường mới "${school.trim()}"`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
