import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./login-form";
import { ApiError } from "@/lib/api/types";

const replaceMock = vi.fn();
const searchParamsState = vi.hoisted(() => ({ next: null as string | null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(searchParamsState.next ? { next: searchParamsState.next } : {}),
}));

const loginMock = vi.fn();
const mfaVerifyMock = vi.fn();
const authState = vi.hoisted(() => ({ principal: null as { roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ ...authState, login: loginMock, mfaVerify: mfaVerifyMock }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    searchParamsState.next = null;
  });

  it("submits username/password and redirects by role on success", async () => {
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(loginMock).toHaveBeenCalledWith("admin", "secret123");
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects STUDENT_PARENT to /portal instead of /dashboard", async () => {
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "STUDENT_PARENT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "parent1");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/portal");
  });

  it("shows a Vietnamese error message on invalid credentials and never logs the password", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    loginMock.mockRejectedValue(new ApiError(401, { error: { code: "INVALID_CREDENTIALS", message: "bad", requestId: "r1" } }));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tên đăng nhập hoặc mật khẩu không đúng.");
    // The password field is cleared after a failed attempt — not retained/rendered back.
    expect(screen.getByLabelText("Mật khẩu")).toHaveValue("");
    for (const call of consoleSpy.mock.calls) {
      expect(call.join(" ")).not.toContain("wrong-password");
    }
    consoleSpy.mockRestore();
  });

  it("shows the account-locked message with lockedUntil when the backend returns it", async () => {
    loginMock.mockRejectedValue(
      new ApiError(423, { error: { code: "ACCOUNT_LOCKED", message: "locked", requestId: "r1", lockedUntil: "2026-01-01T10:00:00.000Z" } }),
    );
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/tạm khóa/);
  });

  it("switches to the MFA step when the backend responds mfaRequired, then verifies and redirects", async () => {
    loginMock.mockResolvedValue({ mfaRequired: true, mfaToken: "mfa-token-abc" });
    mfaVerifyMock.mockResolvedValue({ userId: "u1", roleCode: "EXECUTIVE_DIRECTOR", sessionId: "s1" });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByLabelText("Mã xác thực")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Mã xác thực"), "123456");
    await userEvent.click(screen.getByRole("button", { name: "Xác thực" }));

    expect(mfaVerifyMock).toHaveBeenCalledWith("mfa-token-abc", "123456");
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("F09: honors a safe internal ?next= path instead of the role default", async () => {
    searchParamsState.next = "/cases/123";
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/cases/123");
  });

  it("F09 hardening: rejects a protocol-relative ?next=//evil.com (open-redirect shape), falling back to the role default", async () => {
    searchParamsState.next = "//evil.com/phishing";
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("F09 hardening: rejects ?next=/login (would loop straight back to the login page), falling back to the role default", async () => {
    searchParamsState.next = "/login";
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("F11A hardening: rejects ?next=/api/... (the same-origin API proxy path, never a real page), falling back to the role default", async () => {
    searchParamsState.next = "/api/students";
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("F11A hardening: rejects a backslash-prefixed ?next=/\\evil.com (a known WHATWG-URL backslash-normalization bypass for a //-only check), falling back to the role default", async () => {
    searchParamsState.next = "/\\evil.com/phishing";
    loginMock.mockResolvedValue({ mfaRequired: false, principal: { userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" } });
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Tên đăng nhập"), "admin");
    await userEvent.type(screen.getByLabelText("Mật khẩu"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });
});
