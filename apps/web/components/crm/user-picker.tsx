"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { listUsers } from "@/lib/users/api";
import { useDebouncedValue } from "@/lib/utils/use-debounced-value";
import { Input } from "@/components/ui/input";

/// Picks a target user ID for owner-assignment/member-add flows. `GET /users` is
/// `users:view`-gated and most assigning roles (DEPARTMENT_MANAGER/CONSULTANT) lack it — so
/// this degrades to a plain UUID input for them (documented limitation, PHASE_F03.md), never
/// a client-side workaround that calls a different endpoint to fetch names. `required`
/// (default `true`, matching every F03 usage where a target user is mandatory) must be set
/// `false` by an F04 caller using this picker for a genuinely optional field (e.g. a
/// milestone/writing-artifact owner) — otherwise the fallback input's native `required`
/// attribute silently blocks the whole form's submission even though the field is optional.
export function UserPicker({
  value,
  onChange,
  label,
  required = true,
}: {
  value: string;
  onChange: (userId: string) => void;
  label: string;
  required?: boolean;
}) {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const canBrowseUsers = can("users", "view");
  const inputId = useId();

  const { data, isLoading } = useQuery({
    queryKey: ["users", "picker", debouncedSearch],
    queryFn: () => listUsers({ search: debouncedSearch || undefined, limit: 10 }),
    enabled: canBrowseUsers,
  });

  if (!canBrowseUsers) {
    return (
      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
          {label} (User ID)
        </label>
        <Input id={inputId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID người dùng" required={required} />
        <p className="mt-1 text-xs text-muted-foreground">
          Tài khoản của bạn không có quyền tra cứu danh sách người dùng — nhập trực tiếp User ID.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <Input
        id={inputId}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Tìm theo tên đăng nhập hoặc email..."
      />
      <div className="mt-1 max-h-40 overflow-y-auto rounded border border-border">
        {isLoading ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">Đang tìm...</p>
        ) : data && data.data.length > 0 ? (
          <ul>
            {data.data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onChange(u.id)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${value === u.id ? "bg-muted font-medium" : ""}`}
                >
                  {u.fullName} ({u.username})
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
