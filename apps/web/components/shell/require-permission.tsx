"use client";

import { usePermissions } from "@/lib/permissions/use-permissions";
import type { Action, Resource } from "@/lib/permissions/rbac-data";

/// Permission-gated section boundary (F02 instruction §9's "PERMISSION-GATED" category —
/// admin/finance/reporting/... pages). This is a UX convenience, not authorization
/// (§10/§12): a role denied here would also be denied `403 PERMISSION_DENIED` by the real
/// backend call the page underneath makes — this component only avoids rendering a page
/// shell that would immediately fail, and shows a clear "forbidden" state instead of an
/// empty/broken page.
export function RequirePermission({
  resource,
  action,
  children,
}: {
  resource: Resource;
  action: Action;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();

  if (!can(resource, action)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <h2 className="text-lg font-semibold">Không có quyền truy cập.</h2>
        <p className="text-sm text-muted-foreground">
          Tài khoản của bạn không có quyền <code className="rounded bg-muted px-1">{resource}:{action}</code>.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
