import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { NotificationRecord } from "@/lib/notifications/types";
import { NotificationsContent } from "./page";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const portalApi = vi.hoisted(() => ({ listPortalNotifications: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);
const notificationsApi = vi.hoisted(() => ({ markNotificationRead: vi.fn() }));
vi.mock("@/lib/notifications/notifications-api", () => notificationsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: "n1",
    recipientId: "u1",
    event: "VISA_RESULT",
    channel: "IN_APP",
    payload: { visaId: "visa-1" },
    sentAt: "2026-01-01T00:00:00.000Z",
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/// F08 instruction §25 — the SAME recipient-scoped inbox F07 built, reached through the
/// Portal's own route; `:id` in the URL is scope-check consistency only, not a second data
/// source.
describe("Portal NotificationsContent", () => {
  it("marks an unread notification read and navigates to its mapped resource on click", async () => {
    portalApi.listPortalNotifications.mockResolvedValue({ data: [makeNotification()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
    notificationsApi.markNotificationRead.mockResolvedValue(makeNotification({ readAt: "2026-01-02T00:00:00.000Z" }));
    const user = userEvent.setup();

    renderWithProviders(<NotificationsContent studentId="student-A" />);
    await user.click(await screen.findByRole("button", { name: "Có kết quả visa" }));

    await waitFor(() => expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith("n1"));
    // Portal-aware navigation — lands back inside the Portal shell, never F07's staff route.
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/portal/students/student-A/visa/visa-1"));
  });

  it("shows an empty state with no notifications", async () => {
    portalApi.listPortalNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    renderWithProviders(<NotificationsContent studentId="student-A" />);
    expect(await screen.findByText("Không có thông báo nào.")).toBeInTheDocument();
  });
});
