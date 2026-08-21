import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { Contract } from "@/lib/contracts/types";
import ContractsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const contractsApi = vi.hoisted(() => ({
  listContracts: vi.fn(),
  getContract: vi.fn(),
  createContract: vi.fn(),
}));
vi.mock("@/lib/contracts/api", () => contractsApi);

beforeEach(() => {
  vi.resetAllMocks();
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ContractsPage (list)", () => {
  it("shows the forbidden state for a role without contracts:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(<ContractsPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(contractsApi.listContracts).not.toHaveBeenCalled();
  });

  it("renders the student name via the DEC-10 relation summary, never a bare studentId", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.listContracts.mockResolvedValue({
      data: [makeContract()],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    renderWithProviders(<ContractsPage />);

    expect(await screen.findByText("HD-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Trần Văn A")).toBeInTheDocument();
  });

  it("shows the empty state when there are no contracts", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.listContracts.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });

    renderWithProviders(<ContractsPage />);

    expect(await screen.findByText("Không có hợp đồng nào.")).toBeInTheDocument();
  });

  it("shows a generic error + requestId on a 500, never a stack trace", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.listContracts.mockRejectedValue(new ApiError(500, { error: { code: "INTERNAL", message: "boom", requestId: "req-42" } }));

    renderWithProviders(<ContractsPage />);

    expect(await screen.findByText("Đã xảy ra lỗi khi tải dữ liệu.")).toBeInTheDocument();
    expect(screen.getByText(/req-42/)).toBeInTheDocument();
  });

  it("hides + Tạo hợp đồng for a role without contracts:create (STUDENT_PARENT, view-only)", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    contractsApi.listContracts.mockResolvedValue({ data: [makeContract()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<ContractsPage />);

    await screen.findByText("HD-2026-00001");
    expect(screen.queryByRole("button", { name: "+ Tạo hợp đồng" })).not.toBeInTheDocument();
  });

  it("creates a contract via the dialog and calls createContract with the entered fields", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    contractsApi.listContracts.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    contractsApi.createContract.mockResolvedValue(makeContract());

    renderWithProviders(<ContractsPage />);
    await screen.findByText("Không có hợp đồng nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo hợp đồng" }));
    // ADMIN_FINANCE has no students:view grant — StudentPicker degrades to a manual UUID input.
    await userEvent.type(screen.getByLabelText("Học sinh (Student ID)"), "student-9");
    await userEvent.type(screen.getByLabelText("Giá trị *"), "3000");
    await userEvent.clear(screen.getByLabelText("Tiền tệ *"));
    await userEvent.type(screen.getByLabelText("Tiền tệ *"), "USD");
    await userEvent.click(screen.getByRole("button", { name: "Tạo hợp đồng" }));

    await waitFor(() =>
      expect(contractsApi.createContract).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: "student-9", value: 3000, currency: "USD" }),
      ),
    );
  });
});
