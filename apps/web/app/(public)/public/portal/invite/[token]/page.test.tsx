import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import { AcceptInvitationForm } from "./page";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const portalAccessApi = vi.hoisted(() => ({ acceptParentInvitation: vi.fn() }));
vi.mock("@/lib/portal-access/api", () => portalAccessApi);

beforeEach(() => {
  vi.resetAllMocks();
});

/// The one deliberately unauthenticated page in this app (F08 instruction §5-adjacent — no
/// `RequireAuth` wraps it at all, matching the backend's own `@Public()` gate). No auth mock
/// is needed/possible here since the component never calls `useAuth()`.
describe("AcceptInvitationPage — public, token-authorized (no session required)", () => {
  it("accepts with optional username/password and shows the success state", async () => {
    portalAccessApi.acceptParentInvitation.mockResolvedValue({ studentContactId: "contact-1" });
    const user = userEvent.setup();

    renderWithProviders(<AcceptInvitationForm token="tok-123" />);

    await user.type(await screen.findByLabelText("Tên đăng nhập (tùy chọn)"), "phuhuynh1");
    await user.type(screen.getByLabelText("Mật khẩu (tùy chọn)"), "matkhau123");
    await user.click(screen.getByRole("button", { name: "Chấp nhận lời mời" }));

    await waitFor(() => expect(portalAccessApi.acceptParentInvitation).toHaveBeenCalledWith("tok-123", { username: "phuhuynh1", password: "matkhau123" }));
    expect(await screen.findByText("Đã kích hoạt tài khoản")).toBeInTheDocument();
  });

  it("surfaces an expired/used invitation error verbatim without navigating away", async () => {
    portalAccessApi.acceptParentInvitation.mockRejectedValue(
      new ApiError(409, { error: { code: "INVALID_OR_USED_INVITATION", message: "bad", requestId: "r1" } }),
    );
    const user = userEvent.setup();

    renderWithProviders(<AcceptInvitationForm token="tok-expired" />);
    await user.click(await screen.findByRole("button", { name: "Chấp nhận lời mời" }));

    expect(await screen.findByText("Đường dẫn mời này không hợp lệ hoặc đã được sử dụng.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
