import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./sidebar";

const authState = vi.hoisted(() => ({ principal: null as { roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("Sidebar — permission-aware navigation", () => {
  it("SALES_MARKETING sees Leads but not Students/Cases/Admin (F02 instruction §16 — capability-driven, not role-name-driven)", () => {
    authState.principal = { roleCode: "SALES_MARKETING" };
    render(<Sidebar />);

    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.queryByText("Học sinh")).not.toBeInTheDocument();
    expect(screen.queryByText("Case")).not.toBeInTheDocument();
    expect(screen.queryByText("Người dùng")).not.toBeInTheDocument();
  });

  it("SYSTEM_ADMIN sees only the Admin group, not CRM/Commercial", () => {
    authState.principal = { roleCode: "SYSTEM_ADMIN" };
    render(<Sidebar />);

    expect(screen.getByText("Người dùng")).toBeInTheDocument();
    expect(screen.getByText("Audit log")).toBeInTheDocument();
    expect(screen.queryByText("Leads")).not.toBeInTheDocument();
    expect(screen.queryByText("Hợp đồng")).not.toBeInTheDocument();
  });

  it("a group with zero visible items after filtering renders no heading at all — STUDENT_PARENT has students/cases/contracts view but no reports/leads/partner/admin grant", () => {
    authState.principal = { roleCode: "STUDENT_PARENT" };
    render(<Sidebar />);

    expect(screen.getByText("Học sinh")).toBeInTheDocument();
    expect(screen.getByText("Case")).toBeInTheDocument();
    expect(screen.getByText("Hợp đồng")).toBeInTheDocument();
    // Whole groups absent — not merely items filtered within a still-visible group.
    expect(screen.queryByText("Tổng quan")).not.toBeInTheDocument();
    expect(screen.queryByText("Leads")).not.toBeInTheDocument();
    expect(screen.queryByText("Đối tác")).not.toBeInTheDocument();
    expect(screen.queryByText("Quản trị")).not.toBeInTheDocument();
  });
});
