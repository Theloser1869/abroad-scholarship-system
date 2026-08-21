import { RequireAuth } from "@/components/shell/require-auth";
import { RequirePermission } from "@/components/shell/require-permission";
import { UserMenu } from "@/components/shell/user-menu";
import { NotificationBell } from "@/components/shell/notification-bell";

/// Student/Parent Portal shell — the SAME app as staff, a different route group + shell only
/// (docs/frontend/FRONTEND_ARCHITECTURE.md §11). Responsive-first, no sidebar. Gated by
/// `portal:access` (`RequirePermission`) on top of the base `RequireAuth` — matches the
/// backend's own class-level gate on `PortalController` exactly
/// (docs/security/RBAC_MATRIX.md §2 Phase 11 note: granted only to `STUDENT_PARENT`), so a
/// staff account navigating here sees a clear "forbidden" message instead of a portal shell
/// that would just 403 on every fetch underneath.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequirePermission resource="portal" action="access">
        <div className="flex min-h-full flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-semibold">Cổng thông tin Học sinh &amp; Phụ huynh</span>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-4">{children}</main>
        </div>
      </RequirePermission>
    </RequireAuth>
  );
}
