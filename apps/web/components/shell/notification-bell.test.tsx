import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { NotificationBell } from "./notification-bell";

const authState = vi.hoisted(() => ({ status: "AUTHENTICATED" as const }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const pathnameState = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameState.pathname }));

const notificationsApi = vi.hoisted(() => ({ listNotifications: vi.fn() }));
vi.mock("@/lib/notifications/notifications-api", () => notificationsApi);

beforeEach(() => {
  vi.resetAllMocks();
  pathnameState.pathname = "/dashboard";
});

describe("NotificationBell — shared between the staff shell and the Portal shell", () => {
  it("links to /notifications (F07's full inbox) in the staff shell", async () => {
    notificationsApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 1, totalItems: 3, totalPages: 3 } });
    renderWithProviders(<NotificationBell />);
    const link = await screen.findByRole("link", { name: /Thông báo, 3 chưa đọc/ });
    expect(link).toHaveAttribute("href", "/notifications");
  });

  it("stays a non-interactive badge in the Portal shell — F08 owns the Portal inbox, not F07", async () => {
    pathnameState.pathname = "/portal/students/student-1";
    notificationsApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 1, totalItems: 2, totalPages: 2 } });
    renderWithProviders(<NotificationBell />);
    await screen.findByLabelText(/Thông báo, 2 chưa đọc/);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
