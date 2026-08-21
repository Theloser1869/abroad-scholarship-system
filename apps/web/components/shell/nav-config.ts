import type { Action, Resource } from "@/lib/permissions/rbac-data";

export interface NavItem {
  label: string;
  href: string;
  resource: Resource;
  action: Action;
  /**
   * Whether this route has real page content yet. F01/F02 only built `/dashboard` as a
   * placeholder — every other domain route is F03+ scope. An unimplemented item still
   * renders (so the nav's shape reflects the real route map) but disabled, never as a link
   * to a page with fake content (F02 instruction §15).
   */
  implemented: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/// Permission-gated navigation (F02 instruction §16) — every item names the exact backend
/// `resource:action` it requires (docs/frontend/FRONTEND_PERMISSION_MAP.md /
/// docs/frontend/FRONTEND_ROUTES.md), never a role-name check. Only top-level/global routes
/// are listed — most domains (Counseling/Admission transactions/Visa execution/Enrollment)
/// are Case-scoped with no bare list route (FRONTEND_ROUTES.md), so they are reached from a
/// specific Case's detail page, not this top-level nav, once F03+ builds that page.
export const STAFF_NAV: NavGroup[] = [
  {
    label: "Tổng quan",
    items: [{ label: "Dashboard", href: "/dashboard", resource: "reports", action: "view", implemented: true }],
  },
  {
    label: "CRM",
    items: [
      { label: "Leads", href: "/leads", resource: "leads", action: "view", implemented: true },
      { label: "Học sinh", href: "/students", resource: "students", action: "view", implemented: true },
      { label: "Case", href: "/cases", resource: "cases", action: "view", implemented: true },
    ],
  },
  {
    label: "Thương mại",
    items: [{ label: "Hợp đồng", href: "/contracts", resource: "contracts", action: "view", implemented: true }],
  },
  {
    label: "Admission (master data)",
    items: [
      { label: "Trường đại học", href: "/universities", resource: "admission_master", action: "view", implemented: false },
      { label: "Chương trình", href: "/programs", resource: "admission_master", action: "view", implemented: false },
      { label: "Học bổng", href: "/scholarship-masters", resource: "admission_master", action: "view", implemented: false },
    ],
  },
  {
    label: "Visa",
    items: [{ label: "Mẫu checklist visa", href: "/visa-checklist-templates", resource: "visa_checklist_templates", action: "view", implemented: false }],
  },
  {
    label: "Đối tác",
    items: [{ label: "Đối tác", href: "/partners", resource: "partner", action: "view", implemented: false }],
  },
  {
    label: "Báo cáo",
    items: [{ label: "Báo cáo", href: "/reports", resource: "reports", action: "view", implemented: false }],
  },
  {
    label: "Quản trị",
    items: [
      { label: "Người dùng", href: "/admin/users", resource: "users", action: "view", implemented: false },
      { label: "Audit log", href: "/admin/audit-logs", resource: "audit_logs", action: "view", implemented: false },
      { label: "Jobs", href: "/admin/jobs", resource: "jobs", action: "view", implemented: false },
    ],
  },
];
