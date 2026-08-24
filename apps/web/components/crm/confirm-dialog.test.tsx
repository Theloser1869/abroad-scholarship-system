import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ConfirmDialog } from "./confirm-dialog";

/// F09 UX hardening (instruction §9) — every destructive no-payload confirmation in the app
/// now goes through this one component instead of `window.confirm`. Covers the contract every
/// call site relies on: renders only when `open`, shows the description when given, disables
/// both buttons while `submitting`, and calls `onConfirm`/`onClose` correctly.
describe("ConfirmDialog", () => {
  it("does not render its content when closed", () => {
    renderWithProviders(<ConfirmDialog open={false} onClose={vi.fn()} title="Xóa mục này" onConfirm={vi.fn()} submitting={false} />);
    expect(screen.queryByRole("button", { name: "Xác nhận" })).not.toBeInTheDocument();
  });

  it("renders the title, optional description, and calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        title="Xóa mục này"
        description="Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        variant="danger"
        onConfirm={onConfirm}
        submitting={false}
      />,
    );

    expect(screen.getByText("Xóa mục này")).toBeInTheDocument();
    expect(screen.getByText("Hành động này không thể hoàn tác.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Hủy is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog open={true} onClose={onClose} title="Xóa mục này" onConfirm={vi.fn()} submitting={false} />);

    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables both Hủy and the confirm button while submitting, and shows a busy label", () => {
    renderWithProviders(<ConfirmDialog open={true} onClose={vi.fn()} title="Xóa mục này" confirmLabel="Xóa" onConfirm={vi.fn()} submitting={true} />);

    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang xử lý..." })).toBeDisabled();
  });
});
