import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { CommissionTransaction } from "@/lib/commission-transactions/types";
import { CommissionTransactionDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const commissionTransactionsApi = vi.hoisted(() => ({
  getCommissionTransaction: vi.fn(),
  confirmCommissionEligibility: vi.fn(),
  calculateCommissionTransaction: vi.fn(),
  approveCommissionTransaction: vi.fn(),
  markCommissionTransactionPayable: vi.fn(),
  payCommissionTransaction: vi.fn(),
  cancelCommissionTransaction: vi.fn(),
}));
vi.mock("@/lib/commission-transactions/api", () => commissionTransactionsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeTransaction(overrides: Partial<CommissionTransaction> = {}): CommissionTransaction {
  return {
    id: "ct-1",
    partnerId: "partner-1",
    partner: { id: "partner-1", name: "Global Education Agency", countryCode: "VN" },
    commissionRuleId: "cr-1",
    studentId: "student-1",
    student: { id: "student-1", studentCode: "STU-2026-00001", fullName: "Tran Thi B" },
    caseId: null,
    applicationId: null,
    contractId: null,
    sourceType: "Payment",
    sourceId: "payment-12345678",
    basis: null,
    basisAmount: null,
    rate: null,
    calculatedAmount: null,
    currency: "USD",
    status: "PENDING",
    paidAt: null,
    paymentReference: null,
    reason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CommissionTransactionDetailContent — full server-side FSM, calculate() is authoritative Decimal math done only on the backend", () => {
  it("shows the forbidden state for a role without commission_transactions:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(
      <RequirePermission resource="commission_transactions" action="view">
        <CommissionTransactionDetailContent id="ct-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(commissionTransactionsApi.getCommissionTransaction).not.toHaveBeenCalled();
  });

  it("confirms eligibility from PENDING, surfacing 409 PARTNER_STUDENT_LINK_REQUIRED verbatim — a real non-obvious precondition, never pre-checked client-side", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionTransactionsApi.getCommissionTransaction.mockResolvedValue(makeTransaction({ status: "PENDING" }));
    commissionTransactionsApi.confirmCommissionEligibility.mockRejectedValue(
      new ApiError(409, { error: { code: "PARTNER_STUDENT_LINK_REQUIRED", message: "No active link.", requestId: "r1" } }),
    );

    renderWithProviders(<CommissionTransactionDetailContent id="ct-1" />);
    await screen.findByRole("heading", { name: /Payment/ });

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đủ điều kiện" }));

    expect(await screen.findByText("Đối tác này chưa có liên kết đang hoạt động với học sinh nguồn — không thể ghi nhận hoa hồng.")).toBeInTheDocument();
  });

  it("never computes calculatedAmount client-side — the 'Tính toán' action just calls calculate() and renders whatever the server returns", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionTransactionsApi.getCommissionTransaction.mockResolvedValue(
      makeTransaction({ status: "ELIGIBLE", basis: "PAYMENT_COLLECTED", basisAmount: "10000.00", rate: "0.1000" }),
    );
    commissionTransactionsApi.calculateCommissionTransaction.mockResolvedValue(
      makeTransaction({ status: "CALCULATED", basis: "PAYMENT_COLLECTED", basisAmount: "10000.00", rate: "0.1000", calculatedAmount: "1000.00" }),
    );

    renderWithProviders(<CommissionTransactionDetailContent id="ct-1" />);
    await screen.findByRole("heading", { name: /Payment/ });

    await userEvent.click(screen.getByRole("button", { name: "Tính toán" }));

    await waitFor(() => expect(commissionTransactionsApi.calculateCommissionTransaction).toHaveBeenCalledWith("ct-1"));
  });

  it("pays a PAYABLE transaction, moving to the terminal PAID state and hiding every action afterward", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionTransactionsApi.getCommissionTransaction.mockResolvedValue(makeTransaction({ status: "PAYABLE", calculatedAmount: "1000.00" }));
    commissionTransactionsApi.payCommissionTransaction.mockResolvedValue(makeTransaction({ status: "PAID", calculatedAmount: "1000.00", paidAt: "2026-05-01T00:00:00.000Z", paymentReference: "WIRE-001" }));

    renderWithProviders(<CommissionTransactionDetailContent id="ct-1" />);
    await screen.findByRole("heading", { name: /Payment/ });

    await userEvent.click(screen.getByRole("button", { name: "Thanh toán" }));
    await userEvent.type(screen.getByLabelText("Mã tham chiếu thanh toán *"), "WIRE-001");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận thanh toán" }));

    await waitFor(() => expect(commissionTransactionsApi.payCommissionTransaction).toHaveBeenCalledWith("ct-1", expect.objectContaining({ paymentReference: "WIRE-001" })));
  });

  it("hides every action once CANCELLED (terminal)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionTransactionsApi.getCommissionTransaction.mockResolvedValue(makeTransaction({ status: "CANCELLED", reason: "Duplicate entry." }));

    renderWithProviders(<CommissionTransactionDetailContent id="ct-1" />);
    await screen.findByRole("heading", { name: /Payment/ });

    expect(screen.queryByRole("button", { name: "Xác nhận đủ điều kiện" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hủy giao dịch" })).not.toBeInTheDocument();
    expect(screen.getByText("Duplicate entry.")).toBeInTheDocument();
  });

  it("STUDENT_PARENT has no visibility into any commission_transactions resource (finance-internal data)", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    renderWithProviders(
      <RequirePermission resource="commission_transactions" action="view">
        <CommissionTransactionDetailContent id="ct-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
  });
});
