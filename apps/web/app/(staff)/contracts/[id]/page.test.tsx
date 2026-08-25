import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Contract, ContractAmendment } from "@/lib/contracts/types";
import { ContractDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const contractsApi = vi.hoisted(() => ({
  getContract: vi.fn(),
  listContractAmendments: vi.fn(),
  updateContract: vi.fn(),
  submitContract: vi.fn(),
  approveContract: vi.fn(),
  rejectContract: vi.fn(),
  sendContract: vi.fn(),
  signContract: vi.fn(),
  updateContractStatus: vi.fn(),
  createContractAmendment: vi.fn(),
}));
vi.mock("@/lib/contracts/api", () => contractsApi);

beforeEach(() => {
  vi.resetAllMocks();
  contractsApi.listContractAmendments.mockResolvedValue([]);
});

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    contractCode: "HD-2026-00001",
    studentId: "student-1",
    student: { id: "student-1", studentCode: "HS-2026-00001", fullName: "Trần Văn A" },
    templateId: null,
    mergeFieldValues: null,
    servicePackage: "Gói toàn diện",
    value: "5000.00",
    currency: "USD",
    status: "DRAFT",
    version: 1,
    approvalThreshold: null,
    submittedAt: null,
    signedAt: null,
    signedDocumentId: null,
    approvedById: null,
    approvedAt: null,
    sentAt: null,
    activatedAt: null,
    completedAt: null,
    liquidatedAt: null,
    archivedAt: null,
    closureReason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeAmendment(overrides: Partial<ContractAmendment> = {}): ContractAmendment {
  return {
    id: "amend-1",
    amendmentCode: "AM-2026-00001",
    contractId: "contract-1",
    previousVersion: 1,
    newVersion: 2,
    before: { value: "5000.00" },
    after: { value: "6000.00" },
    reason: "Đổi gói dịch vụ",
    approvedById: "u1",
    effectiveDate: "2026-02-01T00:00:00.000Z",
    createdAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderDetail(id = "contract-1") {
  return renderWithProviders(
    <RequirePermission resource="contracts" action="view">
      <ContractDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("ContractDetailPage", () => {
  it("renders header (student name via DEC-10) and amendment history", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.getContract.mockResolvedValue(makeContract({ status: "ACTIVE", signedAt: "2026-01-15T00:00:00.000Z" }));
    contractsApi.listContractAmendments.mockResolvedValue([makeAmendment()]);

    renderDetail();

    expect(await screen.findByText("HD-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Trần Văn A")).toBeInTheDocument();
    expect(screen.getByText("AM-2026-00001")).toBeInTheDocument();
  });

  it("shows the exact 404-non-enumeration copy for an out-of-scope/nonexistent contract", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.getContract.mockRejectedValue(new ApiError(404, { error: { code: "CONTRACT_NOT_FOUND", message: "not found", requestId: "r1" } }));

    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("hides Duyệt/Từ chối for ADMIN_FINANCE (contracts:approve is ED/DM-only) even while REVIEW", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.getContract.mockResolvedValue(makeContract({ status: "REVIEW" }));

    renderDetail();

    await screen.findByText("HD-2026-00001");
    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("submits the DRAFT contract for review via the dedicated endpoint (never a bare status PATCH)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.getContract.mockResolvedValue(makeContract({ status: "DRAFT" }));
    contractsApi.submitContract.mockResolvedValue(makeContract({ status: "REVIEW" }));

    renderDetail();
    await screen.findByText("HD-2026-00001");

    await userEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

    await waitFor(() => expect(contractsApi.submitContract).toHaveBeenCalledWith("contract-1"));
  });

  it("surfaces APPROVAL_THRESHOLD_EXCEEDED verbatim when a DEPARTMENT_MANAGER tries to approve above threshold", async () => {
    authState.principal = { userId: "u1", roleCode: "DEPARTMENT_MANAGER" };
    contractsApi.getContract.mockResolvedValue(makeContract({ status: "REVIEW", value: "10000.00", approvalThreshold: "5000.00" }));
    contractsApi.approveContract.mockRejectedValue(
      new ApiError(403, { error: { code: "APPROVAL_THRESHOLD_EXCEEDED", message: "threshold exceeded", requestId: "r1", threshold: "5000.00" } }),
    );

    renderDetail();
    await screen.findByText("HD-2026-00001");

    await userEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(
      await screen.findByText("Giá trị hợp đồng vượt ngưỡng phê duyệt — chỉ Giám đốc điều hành mới có thể duyệt."),
    ).toBeInTheDocument();
  });
});
