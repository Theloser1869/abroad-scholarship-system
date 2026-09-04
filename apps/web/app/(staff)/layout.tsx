import { RequireAuth } from "@/components/shell/require-auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { BreadcrumbLabelProvider } from "@/components/shell/breadcrumb-labels";

/// Staff (internal) shell — desktop-first, permission-aware navigation (F02 instruction
/// §15/§16). Route group `(staff)` — contributes no URL segment. `RequireAuth` is the
/// protected-route boundary (§9); everything nested here requires AUTHENTICATED, and the
/// per-item permission filtering happens inside `Sidebar` itself.
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <BreadcrumbLabelProvider>
        <div className="flex min-h-full flex-1 flex-col">
          <Topbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 p-6">
              <Breadcrumbs />
              {children}
            </main>
          </div>
        </div>
      </BreadcrumbLabelProvider>
    </RequireAuth>
  );
}
