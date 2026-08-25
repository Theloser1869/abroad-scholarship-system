import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { CommissionTransaction } from "@/lib/commission-transactions/types";
import CommissionTransactionsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const commissionTransactionsApi = vi.hoisted(() => ({ listCommissionTransactions: vi.fn() }));
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
    basis: "PAYMENT_COLLECTED",
    basisAmount: "10000.00",
    rate: "0.1000",
    calculatedAmount: "1000.00",
    currency: "USD",
    status: "CALCULATED",
    paidAt: null,
    paymentReference: null,
    reason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CommissionTransactionsPage (list) — global bare GET, distinct from the partner-nested creation flow; financial fields rendered via the shared Money component, never recalculated", () => {
  it("shows the forbidden state for a role without commission_transactions:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(<CommissionTransactionsPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(commissionTransactionsApi.listCommissionTransactions).not.toHaveBeenCalled();
  });

  it("renders the transaction list, formatting calculatedAmount via Money (no frontend recomputation)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionTransactionsApi.listCommissionTransactions.mockResolvedValue({ data: [makeTransaction()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<CommissionTransactionsPage />);

    expect(await screen.findByText("Global Education Agency")).toBeInTheDocument();
    expect(screen.getByText("Tran Thi B (STU-2026-00001)")).toBeInTheDocument();
    expect(screen.getByText(/1[.,]000/)).toBeInTheDocument();
  });
});
