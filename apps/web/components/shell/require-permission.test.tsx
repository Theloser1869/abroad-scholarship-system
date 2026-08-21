import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RequirePermission } from "./require-permission";

const authState = vi.hoisted(() => ({ principal: null as { roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));

describe("RequirePermission", () => {
  it("renders children when the role holds the required permission", () => {
    authState.principal = { roleCode: "SYSTEM_ADMIN" };
    render(
      <RequirePermission resource="users" action="view">
        <p>Danh sách người dùng</p>
      </RequirePermission>,
    );
    expect(screen.getByText("Danh sách người dùng")).toBeInTheDocument();
  });

  it("renders a forbidden state, not the children, when the role lacks the permission", () => {
    authState.principal = { roleCode: "CONSULTANT" };
    render(
      <RequirePermission resource="users" action="view">
        <p>Danh sách người dùng</p>
      </RequirePermission>,
    );
    expect(screen.queryByText("Danh sách người dùng")).not.toBeInTheDocument();
    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
  });

  it("renders forbidden for an unauthenticated (null) principal — never defaults to allow", () => {
    authState.principal = null;
    render(
      <RequirePermission resource="users" action="view">
        <p>Danh sách người dùng</p>
      </RequirePermission>,
    );
    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
  });
});
