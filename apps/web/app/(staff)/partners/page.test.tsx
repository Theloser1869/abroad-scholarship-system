import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { Partner } from "@/lib/partners/types";
import PartnersPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const partnersApi = vi.hoisted(() => ({ listPartners: vi.fn(), getPartner: vi.fn(), createPartner: vi.fn(), updatePartner: vi.fn(), archivePartner: vi.fn() }));
vi.mock("@/lib/partners/api", () => partnersApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-1",
    partnerCode: "PTN-2026-00001",
    name: "Global Education Agency",
    type: "AGENCY",
    countryCode: "VN",
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    ownerId: null,
    internalNotes: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("PartnersPage (list) — GLOBAL master data, distinct from PartnerProgram/PartnerDocument/PartnerStudentLink/CommissionRule/CommissionTransaction", () => {
  it("shows the forbidden state for a role without partner:view", async () => {
    // CONSULTANT now holds view-only `partner:view` (client permission-matrix remediation,
    // 2026-08-25) — SALES_MARKETING has no `partner` grant at all.
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(<PartnersPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(partnersApi.listPartners).not.toHaveBeenCalled();
  });

  it("renders the partner catalog", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    partnersApi.listPartners.mockResolvedValue({ data: [makePartner()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<PartnersPage />);

    expect(await screen.findByText("PTN-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Global Education Agency")).toBeInTheDocument();
  });

  it("creates a partner via the dialog, surfacing 409 DUPLICATE_PARTNER verbatim on a repeat (name, countryCode)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    partnersApi.listPartners.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    partnersApi.createPartner.mockResolvedValue(makePartner());

    renderWithProviders(<PartnersPage />);
    await screen.findByText("Không có đối tác nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo đối tác" }));
    await userEvent.type(screen.getByLabelText("Tên đối tác *"), "New Agency");
    await userEvent.type(screen.getByLabelText("Mã quốc gia (ISO-2) *"), "vn");
    await userEvent.click(screen.getByRole("button", { name: "Tạo đối tác" }));

    await waitFor(() => expect(partnersApi.createPartner).toHaveBeenCalledWith(expect.objectContaining({ name: "New Agency", countryCode: "VN" })));
  });
});
