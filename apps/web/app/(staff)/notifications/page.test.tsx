import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { NotificationRecord } from "@/lib/notifications/types";
import NotificationsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const notificationsApi = vi.hoisted(() => ({ listNotifications: vi.fn(), markNotificationRead: vi.fn() }));
vi.mock("@/lib/notifications/notifications-api", () => notificationsApi);

beforeEach(() => {
  vi.resetAllMocks();
  authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
});

function makeNotification(overrides: Partial<NotificationRecord> = {}): NotificationRecord {
  return {
    id: "n1",
    recipientId: "u1",
    event: "VISA_SUBMITTED",
    channel: "IN_APP",
    payload: { visaId: "visa-1", visaCode: "VISA-2026-00001" },
    sentAt: "2026-01-01T00:00:00.000Z",
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/// No permission gate on this page (self-service — every authenticated role reads only its
/// own inbox), so there is no "forbidden state" test here, unlike every other F03-F07 list
/// page — matches `NotificationsController` having no `@RequirePermission` decorator at all.
describe("NotificationsPage — self-service inbox, recipient-scoped only", () => {
  it("renders the inbox using the real event → label/icon map, never the raw event string for a known event", async () => {
    notificationsApi.listNotifications.mockResolvedValue({ data: [makeNotification()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText("Hồ sơ visa đã nộp")).toBeInTheDocument();
    expect(notificationsApi.listNotifications).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it("falls back to the raw event string for an unmapped event, with no fabricated navigation link", async () => {
    notificationsApi.listNotifications.mockResolvedValue({
      data: [makeNotification({ id: "n2", event: "SOME_FUTURE_EVENT", payload: {} })],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    renderWithProviders(<NotificationsPage />);

    expect(await screen.findByText("SOME_FUTURE_EVENT")).toBeInTheDocument();
    // Rendered as plain text (no button/link), not a guessed href.
    expect(screen.queryByRole("button", { name: "SOME_FUTURE_EVENT" })).not.toBeInTheDocument();
  });

  it("clicking an unread row with a resolvable event marks it read and navigates to the linked resource", async () => {
    notificationsApi.listNotifications.mockResolvedValue({ data: [makeNotification()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
    notificationsApi.markNotificationRead.mockResolvedValue(makeNotification({ readAt: "2026-01-02T00:00:00.000Z" }));
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />);
    await user.click(await screen.findByRole("button", { name: "Hồ sơ visa đã nộp" }));

    await waitFor(() => expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith("n1"));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/visas/visa-1"));
  });

  it("switching to the Unread tab re-queries with unreadOnly, and the channel filter is backend-driven, not a client-side slice", async () => {
    notificationsApi.listNotifications.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />);
    await screen.findByText(/Không có thông báo nào/);

    await user.click(screen.getByRole("button", { name: "Chưa đọc" }));
    await waitFor(() => expect(notificationsApi.listNotifications).toHaveBeenLastCalledWith({ page: 1, limit: 20, unreadOnly: true }));

    await user.selectOptions(screen.getByLabelText("Lọc theo kênh"), "EMAIL");
    await waitFor(() => expect(notificationsApi.listNotifications).toHaveBeenLastCalledWith({ page: 1, limit: 20, unreadOnly: true, channel: "EMAIL" }));
  });

  it("marks every unread row on the current page read via the bulk action (looping the single-item endpoint — no bulk endpoint exists)", async () => {
    notificationsApi.listNotifications.mockResolvedValue({
      data: [makeNotification({ id: "n1" }), makeNotification({ id: "n2", event: "TASK_ASSIGNED", payload: {} })],
      meta: { page: 1, limit: 20, totalItems: 2, totalPages: 1 },
    });
    notificationsApi.markNotificationRead.mockResolvedValue(makeNotification({ readAt: "2026-01-02T00:00:00.000Z" }));
    const user = userEvent.setup();

    renderWithProviders(<NotificationsPage />);
    await screen.findByText("Hồ sơ visa đã nộp");

    await user.click(screen.getByRole("button", { name: "Đánh dấu đã đọc (trang này)" }));

    await waitFor(() => {
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith("n1");
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith("n2");
    });
  });
});
