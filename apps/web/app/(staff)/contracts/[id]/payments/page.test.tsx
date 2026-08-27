import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Contract } from "@/lib/contracts/types";
import type { Payment } from "@/lib/payments/types";
import { ContractPaymentsContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const contractsApi = vi.hoisted(() => ({ getContract: vi.fn() }));
vi.mock("@/lib/contracts/api", () => contractsApi);

const paymentsApi = vi.hoisted(() => ({
  listPaymentsForContract: vi.fn(),
  getPayment: vi.fn(),
  createPayment: vi.fn(),
  recordPayment: vi.fn(),
  refundPayment: vi.fn(),
  waivePayment: vi.fn(),
}));
vi.mock("@/lib/payments/api", () => paymentsApi);

beforeEach(() => {
  vi.resetAllMocks();
  contractsApi.getContract.mockResolvedValue(baseContract());
});

function baseContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    contractCode: "HD-2026-00001",
    studentId: "student-1",
    student: { id: "student-1", studentCode: "HS-2026-00001", fullName: "Trần Văn A" },
    caseId: null,
    templateId: null,
    mergeFieldValues: null,
    servicePackage: null,
    value: "5000.00",
    currency: "USD",
    status: "ACTIVE",
    version: 1,
    approvalThreshold: null,
    submittedAt: null,
    signedAt: "2026-01-10T00:00:00.000Z",
    signedDocumentId: "doc-1",
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

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    paymentCode: "PAY-2026-00001",
    contractId: "contract-1",
    installmentNo: 1,
    amount: "2500.00",
    currency: "USD",
    dueDate: "2026-02-01T00:00:00.000Z",
    paidAmount: "0.00",
    paidDate: null,
    method: null,
    reference: null,
    status: "PENDING",
    receiptDocumentId: null,
    refundedAmount: "0.00",
    refundedAt: null,
    refundedById: null,
    refundReason: null,
    waivedAt: null,
    waivedById: null,
    waivedReason: null,
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    outstandingAmount: "2500.00",
    isOverdue: false,
    ...overrides,
  };
}

function renderPage(contractId = "contract-1") {
  return renderWithProviders(
    <RequirePermission resource="payments" action="view">
      <ContractPaymentsContent contractId={contractId} />
    </RequirePermission>,
  );
}

describe("ContractPaymentsPage", () => {
  it("shows the forbidden state for a role without payments:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderPage();
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(paymentsApi.listPaymentsForContract).not.toHaveBeenCalled();
  });

  it("renders the installment list with server-computed outstandingAmount/isOverdue, never recalculated", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    paymentsApi.listPaymentsForContract.mockResolvedValue({
      data: [makePayment({ isOverdue: true, outstandingAmount: "2500.00" })],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });

    renderPage();

    expect(await screen.findByText("Quá hạn")).toBeInTheDocument();
  });

  it("opens payment detail and issues a refund with amount + required reason", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    const paid = makePayment({ status: "PAID", paidAmount: "2500.00", outstandingAmount: "0.00" });
    paymentsApi.listPaymentsForContract.mockResolvedValue({ data: [paid], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
    paymentsApi.getPayment.mockResolvedValue(paid);
    paymentsApi.refundPayment.mockResolvedValue(makePayment({ status: "REFUNDED" }));

    renderPage();
    await userEvent.click(await screen.findByText("PAY-2026-00001"));

    await userEvent.click(await screen.findByRole("button", { name: "Hoàn tiền" }));
    await userEvent.type(screen.getByLabelText("Số tiền hoàn *"), "500");
    await userEvent.type(screen.getByLabelText("Lý do *"), "Khách hàng yêu cầu hoàn một phần");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận hoàn tiền" }));

    await waitFor(() =>
      expect(paymentsApi.refundPayment).toHaveBeenCalledWith("payment-1", expect.objectContaining({ amount: 500, reason: "Khách hàng yêu cầu hoàn một phần" })),
    );
  });

  it("hides Hoàn tiền/Miễn for STUDENT_PARENT (view-only) even after opening detail", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    const pending = makePayment();
    paymentsApi.listPaymentsForContract.mockResolvedValue({ data: [pending], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
    paymentsApi.getPayment.mockResolvedValue(pending);

    renderPage();
    await userEvent.click(await screen.findByText("PAY-2026-00001"));

    await screen.findByText("Kỳ thanh toán PAY-2026-00001");
    expect(screen.queryByRole("button", { name: "Hoàn tiền" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Miễn khoản này" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi nhận thanh toán" })).not.toBeInTheDocument();
  });

  it("surfaces OVERPAYMENT_NOT_ALLOWED verbatim and re-confirms with allowOverpayment: true", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    const pending = makePayment();
    paymentsApi.listPaymentsForContract.mockResolvedValue({ data: [pending], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });
    paymentsApi.getPayment.mockResolvedValue(pending);
    paymentsApi.recordPayment
      .mockRejectedValueOnce(
        new ApiError(409, {
          error: { code: "OVERPAYMENT_NOT_ALLOWED", message: "overpayment", requestId: "r1", outstandingBeforePayment: "2500.00" },
        }),
      )
      .mockResolvedValueOnce(makePayment({ status: "PAID" }));

    renderPage();
    await userEvent.click(await screen.findByText("PAY-2026-00001"));
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận thanh toán" }));

    const amountInput = screen.getByLabelText("Số tiền *");
    await userEvent.clear(amountInput);
    await userEvent.type(amountInput, "3000");
    await userEvent.click(screen.getByRole("button", { name: "Ghi nhận" }));

    expect(await screen.findByText(/còn lại: 2500.00/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận cho phép trả dư" }));

    await waitFor(() =>
      expect(paymentsApi.recordPayment).toHaveBeenLastCalledWith("payment-1", expect.objectContaining({ allowOverpayment: true })),
    );
  });
});
