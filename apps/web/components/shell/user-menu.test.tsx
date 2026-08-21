import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "./user-menu";

const logoutMock = vi.fn();
const authState = vi.hoisted(() => ({
  principal: null as { userId: string; roleCode: string; sessionId: string } | null,
  displayUser: null as { fullName: string } | null,
}));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ ...authState, logout: logoutMock }),
}));

describe("UserMenu", () => {
  it("renders nothing when there is no session", () => {
    authState.principal = null;
    authState.displayUser = null;
    const { container } = render(<UserMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the login-response display name when available", () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" };
    authState.displayUser = { fullName: "Nguyễn Văn A" };
    render(<UserMenu />);
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("(Tư vấn)")).toBeInTheDocument();
  });

  it("falls back to the role label when displayUser is null (session restored via silent refresh, not a fresh login)", () => {
    authState.principal = { userId: "u1", roleCode: "SYSTEM_ADMIN", sessionId: "s1" };
    authState.displayUser = null;
    render(<UserMenu />);
    // Both the name slot and the role slot show the role label in this fallback case.
    expect(screen.getAllByText("System Admin").length).toBeGreaterThan(0);
  });

  it("clicking Đăng xuất calls logout()", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" };
    authState.displayUser = { fullName: "Nguyễn Văn A" };
    render(<UserMenu />);

    await userEvent.click(screen.getByRole("button", { name: /Nguyễn Văn A/ }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Đăng xuất" }));

    expect(logoutMock).toHaveBeenCalledOnce();
  });
});
