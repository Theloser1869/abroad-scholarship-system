import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RequireAuth } from "./require-auth";

const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/dashboard",
}));

const authState = vi.hoisted(() => ({ status: "INITIALIZING" as string }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));

describe("RequireAuth", () => {
  it("shows a loading skeleton while INITIALIZING, never the protected content", () => {
    authState.status = "INITIALIZING";
    render(
      <RequireAuth>
        <p>Nội dung bảo mật</p>
      </RequireAuth>,
    );
    expect(screen.queryByText("Nội dung bảo mật")).not.toBeInTheDocument();
  });

  it("renders children when AUTHENTICATED", () => {
    authState.status = "AUTHENTICATED";
    render(
      <RequireAuth>
        <p>Nội dung bảo mật</p>
      </RequireAuth>,
    );
    expect(screen.getByText("Nội dung bảo mật")).toBeInTheDocument();
  });

  it("redirects to /login (with next=) and renders nothing when UNAUTHENTICATED", async () => {
    authState.status = "UNAUTHENTICATED";
    render(
      <RequireAuth>
        <p>Nội dung bảo mật</p>
      </RequireAuth>,
    );
    expect(screen.queryByText("Nội dung bảo mật")).not.toBeInTheDocument();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fdashboard"));
  });

  it("shows a generic error state on ERROR, never the protected content", () => {
    authState.status = "ERROR";
    render(
      <RequireAuth>
        <p>Nội dung bảo mật</p>
      </RequireAuth>,
    );
    expect(screen.queryByText("Nội dung bảo mật")).not.toBeInTheDocument();
    expect(screen.getByText(/Không thể xác thực/)).toBeInTheDocument();
  });
});
