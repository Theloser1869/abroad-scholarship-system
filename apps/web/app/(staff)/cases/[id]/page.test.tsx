import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { CaseDetailContent } from "./page";
import { ApiError } from "@/lib/api/types";
import type { Case, CaseMember } from "@/lib/cases/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const casesApi = vi.hoisted(() => ({
  listCases: vi.fn(),
  getCase: vi.fn(),
  updateCaseStage: vi.fn(),
  updateCaseStatus: vi.fn(),
  closeCase: vi.fn(),
  listCaseMembers: vi.fn(),
  addCaseMember: vi.fn(),
  removeCaseMember: vi.fn(),
  reassignCaseOwner: vi.fn(),
  addCaseNote: vi.fn(),
  getCaseTimeline: vi.fn(),
}));
vi.mock("@/lib/cases/api", () => casesApi);

const usersApi = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock("@/lib/users/api", () => usersApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCaseTimeline.mockResolvedValue([]);
  casesApi.listCaseMembers.mockResolvedValue([]);
});

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "case-1",
    caseCode: "C-0001",
    studentId: "student-1",
    student: { id: "student-1", studentCode: "HS-0001", fullName: "Phạm Văn C" },
    contractId: null,
    ownerId: "owner-1",
    owner: { id: "owner-1", username: "consultant1", fullName: "Nguyễn Tư Vấn" },
    department: "Tư vấn",
    stage: "DISCOVERY",
    status: "OPEN",
    closureReason: null,
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMember(overrides: Partial<CaseMember> = {}): CaseMember {
  return {
    caseId: "case-1",
    userId: "owner-1",
    user: { id: "owner-1", username: "consultant1", fullName: "Nguyễn Tư Vấn" },
    role: "OWNER",
    addedAt: "2026-01-01T00:00:00.000Z",
    removedAt: null,
    ...overrides,
  };
}

function renderDetail(id = "case-1") {
  return renderWithProviders(
    <RequirePermission resource="cases" action="view">
      <CaseDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("CaseDetailPage", () => {
  it("renders case header (student/owner names) and members list", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.getCase.mockResolvedValue(makeCase());
    casesApi.listCaseMembers.mockResolvedValue([makeMember()]);

    renderDetail();

    expect(await screen.findByText("C-0001")).toBeInTheDocument();
    expect(screen.getByText("Phạm Văn C")).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Tư Vấn").length).toBeGreaterThan(0);
  });

  it("shows the exact 404-non-enumeration copy for an out-of-scope/nonexistent case", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.getCase.mockRejectedValue(
      new ApiError(404, { error: { code: "CASE_NOT_FOUND", message: "not found", requestId: "r1" } }),
    );

    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("hides Giai đoạn/Chuyển trạng thái/Đổi chủ sở hữu/Đóng case/+ Thêm for DOCUMENT_SPECIALIST (cases:view only — RBAC hidden actions)", async () => {
    authState.principal = { userId: "u1", roleCode: "DOCUMENT_SPECIALIST" };
    casesApi.getCase.mockResolvedValue(makeCase());
    casesApi.listCaseMembers.mockResolvedValue([makeMember()]);

    renderDetail();

    await screen.findByText("C-0001");
    expect(screen.queryByRole("button", { name: "Giai đoạn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đổi chủ sở hữu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đóng case" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Thêm" })).not.toBeInTheDocument();
  });

  it("transitions status through the dedicated dialog and calls the FSM endpoint with the selected status", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.getCase.mockResolvedValue(makeCase());
    casesApi.listCaseMembers.mockResolvedValue([]);
    casesApi.updateCaseStatus.mockResolvedValue(makeCase({ status: "ACTIVE" }));

    renderDetail();
    await screen.findByText("C-0001");

    await userEvent.click(screen.getByRole("button", { name: "Chuyển trạng thái" }));
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái mới"), "ACTIVE");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(casesApi.updateCaseStatus).toHaveBeenCalledWith("case-1", "ACTIVE"));
  });

  it("surfaces a failing close precondition (OPEN_TASKS_REMAIN) verbatim, never a generic message", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.getCase.mockResolvedValue(makeCase());
    casesApi.listCaseMembers.mockResolvedValue([]);
    casesApi.closeCase.mockRejectedValue(
      new ApiError(409, { error: { code: "OPEN_TASKS_REMAIN", message: "tasks remain", requestId: "r1" } }),
    );

    renderDetail();
    await screen.findByText("C-0001");

    await userEvent.click(screen.getByRole("button", { name: "Đóng case" }));
    await userEvent.type(screen.getByLabelText("Lý do đóng case *"), "Hoàn tất");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đóng case" }));

    expect(await screen.findByText("Còn task chưa hoàn thành — không thể đóng case.")).toBeInTheDocument();
  });
});
