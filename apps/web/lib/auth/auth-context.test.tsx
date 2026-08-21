import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./auth-context";

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const authApiMock = vi.hoisted(() => ({
  login: vi.fn(),
  mfaLoginVerify: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  refreshSession: vi.fn(),
}));
vi.mock("./auth-api", () => authApiMock);

function TestHarness() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="role">{auth.principal?.roleCode ?? "none"}</p>
      <p data-testid="display-name">{auth.displayUser?.fullName ?? "none"}</p>
      <button onClick={() => auth.login("admin", "pw").catch(() => {})}>login</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
}

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("AuthProvider — session bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves to UNAUTHENTICATED when the silent refresh fails (ordinary anonymous visitor, not an error)", async () => {
    authApiMock.refreshSession.mockResolvedValue(false);
    renderWithProviders();

    expect(screen.getByTestId("status").textContent).toBe("INITIALIZING");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("UNAUTHENTICATED"));
    expect(authApiMock.fetchMe).not.toHaveBeenCalled();
  });

  it("resolves to AUTHENTICATED when refresh succeeds and GET /auth/me returns a principal", async () => {
    authApiMock.refreshSession.mockResolvedValue(true);
    authApiMock.fetchMe.mockResolvedValue({ userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" });
    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("AUTHENTICATED"));
    expect(screen.getByTestId("role").textContent).toBe("CONSULTANT");
    // Bootstrap-only restore never has a display name (GET /auth/me returns no fullName) —
    // see docs/frontend/FRONTEND_AUTH.md "Known backend gap".
    expect(screen.getByTestId("display-name").textContent).toBe("none");
  });

  it("resolves to ERROR on an unexpected failure (not a 401/anonymous case)", async () => {
    authApiMock.refreshSession.mockRejectedValue(new Error("network down"));
    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ERROR"));
  });
});

describe("AuthProvider — login()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApiMock.refreshSession.mockResolvedValue(false); // bootstrap settles to UNAUTHENTICATED first
  });

  it("login success sets AUTHENTICATED + populates displayUser from the login response", async () => {
    authApiMock.login.mockResolvedValue({
      accessToken: "t",
      refreshToken: "r",
      expiresInMinutes: 15,
      user: { id: "u1", username: "admin", email: "a@b.c", fullName: "Nguyễn Văn A", roleCode: "SYSTEM_ADMIN" },
    });
    authApiMock.fetchMe.mockResolvedValue({ userId: "u1", roleCode: "SYSTEM_ADMIN", sessionId: "s1" });
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("UNAUTHENTICATED"));

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("AUTHENTICATED"));
    expect(screen.getByTestId("display-name").textContent).toBe("Nguyễn Văn A");
  });

  it("login failure keeps UNAUTHENTICATED and does not crash the app (error is rethrown to the caller, e.g. the login form)", async () => {
    authApiMock.login.mockRejectedValue(new Error("INVALID_CREDENTIALS"));
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("UNAUTHENTICATED"));

    await userEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("UNAUTHENTICATED"));
    expect(screen.getByTestId("role").textContent).toBe("none");
  });
});

describe("AuthProvider — logout()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears auth state and redirects to /login", async () => {
    authApiMock.refreshSession.mockResolvedValue(true);
    authApiMock.fetchMe.mockResolvedValue({ userId: "u1", roleCode: "CONSULTANT", sessionId: "s1" });
    authApiMock.logout.mockResolvedValue(undefined);
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("AUTHENTICATED"));

    await userEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("UNAUTHENTICATED"));
    expect(screen.getByTestId("role").textContent).toBe("none");
    expect(authApiMock.logout).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
