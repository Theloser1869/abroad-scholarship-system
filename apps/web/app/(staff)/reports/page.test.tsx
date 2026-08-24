import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { ExportCasesResponse } from "@/lib/reports/types";
import ReportsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const reportsApi = vi.hoisted(() => ({ getExecutiveDashboard: vi.fn(), getManagerDashboard: vi.fn(), getMyDashboard: vi.fn(), exportCases: vi.fn() }));
vi.mock("@/lib/reports/api", () => reportsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

const exportFixture: ExportCasesResponse = {
  rowCount: 1,
  rows: [
    {
      id: "case-1",
      caseCode: "CASE-2026-00001",
      studentId: "student-1",
      contractId: null,
      ownerId: "user-1",
      department: "Du học Mỹ",
      stage: "Chuẩn bị hồ sơ",
      status: "OPEN",
      closureReason: null,
      openedAt: "2026-01-01T00:00:00.000Z",
      closedAt: null,
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("ReportsPage — reports:export-gated (ED/DM only, matching ReportsService.exportCases' own assertRole), synchronous export (no job/status polling exists)", () => {
  it("shows the forbidden state for a role with reports:view but no reports:export (CONSULTANT)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(<ReportsPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(reportsApi.exportCases).not.toHaveBeenCalled();
  });

  it("requires a reason of at least 3 characters before the export button enables, then renders the returned rows exactly as the backend sent them", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    reportsApi.exportCases.mockResolvedValue(exportFixture);
    const user = userEvent.setup();

    renderWithProviders(<ReportsPage />);

    const exportButton = screen.getByRole("button", { name: "Xuất danh sách case" });
    expect(exportButton).toBeDisabled();

    await user.type(screen.getByLabelText("Lý do xuất báo cáo *"), "Kiểm toán quý");
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);

    await waitFor(() => expect(reportsApi.exportCases).toHaveBeenCalledWith("Kiểm toán quý"));
    expect(await screen.findByText("CASE-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Kết quả (1 case)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tải xuống CSV" })).toBeInTheDocument();
  });

  it("shows an empty state (not a fabricated zero row) when the scope-filtered export has no rows", async () => {
    authState.principal = { userId: "u1", roleCode: "DEPARTMENT_MANAGER" };
    reportsApi.exportCases.mockResolvedValue({ rowCount: 0, rows: [] });
    const user = userEvent.setup();

    renderWithProviders(<ReportsPage />);
    await user.type(screen.getByLabelText("Lý do xuất báo cáo *"), "Kiểm tra scope");
    await user.click(screen.getByRole("button", { name: "Xuất danh sách case" }));

    expect(await screen.findByText(/Không có case nào trong phạm vi của bạn/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải xuống CSV" })).not.toBeInTheDocument();
  });
});
