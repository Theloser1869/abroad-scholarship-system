import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { CaseClosureContent } from "./page";
import type { ClosureStatus } from "@/lib/closure/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));

const closureApi = vi.hoisted(() => ({
  getClosureStatus: vi.fn(),
  requestClosure: vi.fn(),
  confirmHandover: vi.fn(),
  executeClosure: vi.fn(),
  confirmLiquidationCompany: vi.fn(),
}));
vi.mock("@/lib/closure/api", () => closureApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeStatus(overrides: Partial<ClosureStatus> = {}): ClosureStatus {
  return {
    caseId: "case-1",
    caseCode: "CASE-2026-00001",
    caseStatus: "ACTIVE",
    checklist: [
      { key: "DEBT", status: "PASS" },
      { key: "OPEN_TASKS", status: "PASS" },
      { key: "VISA", status: "NOT_APPLICABLE" },
      { key: "ENROLLMENT", status: "PASS" },
      { key: "PRE_DEPARTURE", status: "PASS" },
      { key: "DOCUMENT_HANDOVER", status: "FAIL", detail: "Chưa bàn giao." },
    ],
    readyToClose: false,
    handover: { status: "PENDING", handedOverAt: null, recipientName: null, notes: null },
    liquidation: null,
    ...overrides,
  };
}

function renderClosure(caseId = "case-1") {
  return renderWithProviders(
    <RequirePermission resource="case-closure" action="view">
      <CaseClosureContent caseId={caseId} />
    </RequirePermission>,
  );
}

describe("CaseClosurePage", () => {
  it("renders the 6-item checklist with statuses, and marks not-ready when a required item FAILs", async () => {
    authState.principal = { userId: "hcth-1", roleCode: "ADMIN_FINANCE" };
    closureApi.getClosureStatus.mockResolvedValue(makeStatus());

    renderClosure();

    expect(await screen.findByText(/CASE-2026-00001/)).toBeInTheDocument();
    expect(screen.getAllByText("Bàn giao tài liệu").length).toBeGreaterThan(0);
    expect(screen.getByText("Chưa đủ điều kiện — cần xử lý các mục Chưa đạt ở trên.")).toBeInTheDocument();
  });

  it("CONSULTANT sees only the request-closure card, never handover/close actions", async () => {
    authState.principal = { userId: "consultant-1", roleCode: "CONSULTANT" };
    closureApi.getClosureStatus.mockResolvedValue(makeStatus());

    renderClosure();
    await screen.findByText(/CASE-2026-00001/);

    expect(screen.getByText("Đề nghị đóng hồ sơ (Tư vấn)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận bàn giao" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng hồ sơ" })).not.toBeInTheDocument();
  });

  it("CONSULTANT requesting closure calls the advisory endpoint, never touching Case status", async () => {
    authState.principal = { userId: "consultant-1", roleCode: "CONSULTANT" };
    closureApi.getClosureStatus.mockResolvedValue(makeStatus());
    closureApi.requestClosure.mockResolvedValue({ requested: true });

    renderClosure();
    await screen.findByText(/CASE-2026-00001/);

    await userEvent.type(screen.getByPlaceholderText(/Đã hoàn tất toàn bộ công việc/), "Xong hết rồi");
    await userEvent.click(screen.getByRole("button", { name: "Gửi đề nghị" }));

    await waitFor(() => expect(closureApi.requestClosure).toHaveBeenCalledWith("case-1", { reason: "Xong hết rồi" }));
  });

  it("HCTH (ADMIN_FINANCE) can close without an override-reason field once the checklist is all PASS/N-A", async () => {
    authState.principal = { userId: "hcth-1", roleCode: "ADMIN_FINANCE" };
    closureApi.getClosureStatus.mockResolvedValue(
      makeStatus({ readyToClose: true, checklist: [{ key: "DOCUMENT_HANDOVER", status: "PASS" }] as ClosureStatus["checklist"] }),
    );
    closureApi.executeClosure.mockResolvedValue({ id: "case-1", status: "CLOSED" });

    renderClosure();
    await screen.findByText(/CASE-2026-00001/);

    expect(screen.queryByLabelText(/Lý do xử lý ngoại lệ/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Lý do đóng hồ sơ *"), "Đã hoàn tất");
    await userEvent.click(screen.getByRole("button", { name: "Đóng hồ sơ" }));

    await waitFor(() =>
      expect(closureApi.executeClosure).toHaveBeenCalledWith("case-1", { closureReason: "Đã hoàn tất", overrideReason: undefined }),
    );
  });

  it("EXECUTIVE_DIRECTOR must fill an override-reason field, and it is submitted alongside closureReason", async () => {
    authState.principal = { userId: "ed-1", roleCode: "EXECUTIVE_DIRECTOR" };
    closureApi.getClosureStatus.mockResolvedValue(
      makeStatus({ readyToClose: true, checklist: [{ key: "DOCUMENT_HANDOVER", status: "PASS" }] as ClosureStatus["checklist"] }),
    );
    closureApi.executeClosure.mockResolvedValue({ id: "case-1", status: "CLOSED" });

    renderClosure();
    await screen.findByText(/CASE-2026-00001/);

    const closeButton = screen.getByRole("button", { name: "Đóng hồ sơ" });
    expect(closeButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Lý do đóng hồ sơ *"), "Đã hoàn tất");
    await userEvent.type(screen.getByLabelText(/Lý do xử lý ngoại lệ/), "HCTH nghỉ phép");
    expect(closeButton).toBeEnabled();

    await userEvent.click(closeButton);
    await waitFor(() =>
      expect(closureApi.executeClosure).toHaveBeenCalledWith("case-1", { closureReason: "Đã hoàn tất", overrideReason: "HCTH nghỉ phép" }),
    );
  });

  it("shows the two-party liquidation section once CLOSED, with independent confirmation status for each side", async () => {
    authState.principal = { userId: "hcth-1", roleCode: "ADMIN_FINANCE" };
    closureApi.getClosureStatus.mockResolvedValue(
      makeStatus({
        caseStatus: "CLOSED",
        liquidation: { status: "PENDING", companyConfirmedAt: "2026-08-26T00:00:00.000Z", studentParentConfirmedAt: null },
      }),
    );

    renderClosure();
    await screen.findByText(/CASE-2026-00001/);

    expect(screen.getByText("Thanh lý (xác nhận hai bên)")).toBeInTheDocument();
    expect(screen.getByText(/Đã xác nhận/)).toBeInTheDocument();
    expect(screen.getByText("Chưa xác nhận")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh lý (phía công ty)" }));
    await waitFor(() => expect(closureApi.confirmLiquidationCompany).toHaveBeenCalledWith("case-1", undefined));
  });
});
