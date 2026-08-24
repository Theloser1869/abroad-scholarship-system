import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { CommissionRule } from "@/lib/commission-rules/types";
import { PartnerCommissionRulesContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const commissionRulesApi = vi.hoisted(() => ({
  listCommissionRules: vi.fn(),
  createCommissionRule: vi.fn(),
  updateCommissionRule: vi.fn(),
  activateCommissionRule: vi.fn(),
  deactivateCommissionRule: vi.fn(),
}));
vi.mock("@/lib/commission-rules/api", () => commissionRulesApi);
const partnersApi = vi.hoisted(() => ({ getPartner: vi.fn() }));
vi.mock("@/lib/partners/api", () => partnersApi);

beforeEach(() => {
  vi.resetAllMocks();
  partnersApi.getPartner.mockResolvedValue({ id: "partner-1", name: "Global Education Agency" });
});

function makeRule(overrides: Partial<CommissionRule> = {}): CommissionRule {
  return {
    id: "cr-1",
    partnerId: "partner-1",
    partnerProgramId: null,
    basis: "CONTRACT_VALUE",
    percentageRate: "0.1000",
    fixedAmount: null,
    currency: "USD",
    conditions: null,
    priority: 0,
    effectiveDate: null,
    expiryDate: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PartnerCommissionRulesContent — config data, never a fact that happened (that's CommissionTransaction), no rule-matching computed client-side", () => {
  it("shows the forbidden state for a role without commission_rules:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(
      <RequirePermission resource="commission_rules" action="view">
        <PartnerCommissionRulesContent partnerId="partner-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(commissionRulesApi.listCommissionRules).not.toHaveBeenCalled();
  });

  it("renders the rule list, formatting percentageRate for display only (never a client-side money calculation)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionRulesApi.listCommissionRules.mockResolvedValue({ data: [makeRule()], meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<PartnerCommissionRulesContent partnerId="partner-1" />);

    expect(await screen.findByText(/Ưu tiên/)).toBeInTheDocument();
    expect(screen.getAllByText("Giá trị hợp đồng").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10% · Ưu tiên/)).toBeInTheDocument();
  });

  it("mirrors the basis/percentageRate/fixedAmount cross-validation as UX guidance, but the backend is the real authority — creates a FIXED-basis rule with fixedAmount", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionRulesApi.listCommissionRules.mockResolvedValue({ data: [], meta: { page: 1, limit: 100, totalItems: 0, totalPages: 0 } });
    commissionRulesApi.createCommissionRule.mockResolvedValue(makeRule({ basis: "FIXED", fixedAmount: "500.00", percentageRate: null }));

    renderWithProviders(<PartnerCommissionRulesContent partnerId="partner-1" />);
    await screen.findByText("Chưa có quy tắc hoa hồng nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo quy tắc" }));
    await userEvent.selectOptions(screen.getByLabelText("Cơ sở tính *"), "FIXED");
    await userEvent.type(screen.getByLabelText("Số tiền cố định *"), "500");
    await userEvent.type(screen.getByLabelText("Tiền tệ *"), "usd");
    await userEvent.click(screen.getByRole("button", { name: "Tạo quy tắc" }));

    await waitFor(() =>
      expect(commissionRulesApi.createCommissionRule).toHaveBeenCalledWith("partner-1", expect.objectContaining({ basis: "FIXED", fixedAmount: 500, currency: "USD" })),
    );
  });

  it("toggles activate/deactivate on an existing rule", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    commissionRulesApi.listCommissionRules.mockResolvedValue({ data: [makeRule({ status: "ACTIVE" })], meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 } });
    commissionRulesApi.deactivateCommissionRule.mockResolvedValue(makeRule({ status: "INACTIVE" }));

    renderWithProviders(<PartnerCommissionRulesContent partnerId="partner-1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Tạm ngưng" }));

    await waitFor(() => expect(commissionRulesApi.deactivateCommissionRule).toHaveBeenCalledWith("cr-1"));
  });
});
