import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import LeadsPage from "./page";
import { ApiError } from "@/lib/api/types";
import type { Lead } from "@/lib/leads/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));

const leadsApi = vi.hoisted(() => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
}));
vi.mock("@/lib/leads/api", () => leadsApi);

const OWNER = { id: "owner-1", username: "consultant1", fullName: "Nguyễn Tư Vấn" };

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    leadCode: "L-0001",
    contactName: "Trần Thị A",
    parentName: null,
    email: "a@example.com",
    phone: null,
    parentPhone: null,
    source: null,
    campaign: null,
    countryInterest: null,
    majorInterest: null,
    intake: null,
    serviceInterest: null,
    ownerId: OWNER.id,
    owner: OWNER,
    score: null,
    status: "NEW",
    convertedStudentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("LeadsPage — list", () => {
  it("shows the forbidden state (never the list) for a role without leads:view", () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(<LeadsPage />);

    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
    expect(leadsApi.listLeads).not.toHaveBeenCalled();
  });

  it("renders leads from the API with owner name — never a bare ownerId (DEC-09)", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.listLeads.mockResolvedValue({
      data: [makeLead()],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderWithProviders(<LeadsPage />);

    expect(await screen.findByText("L-0001")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị A")).toBeInTheDocument();
    expect(screen.getByText(OWNER.fullName)).toBeInTheDocument();
  });

  it("shows the empty state when the API returns zero rows", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.listLeads.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    renderWithProviders(<LeadsPage />);

    expect(await screen.findByText("Không có lead nào.")).toBeInTheDocument();
  });

  it("shows a generic error state (not a crash) when the list call fails with a 500", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.listLeads.mockRejectedValue(
      new ApiError(500, { error: { code: "INTERNAL_ERROR", message: "boom", requestId: "req-1" } }),
    );
    renderWithProviders(<LeadsPage />);

    expect(await screen.findByText("Đã xảy ra lỗi khi tải dữ liệu.")).toBeInTheDocument();
    expect(screen.getByText("req-1", { exact: false })).toBeInTheDocument();
  });

  it("only shows '+ Tạo lead' for a role with leads:create", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.listLeads.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    renderWithProviders(<LeadsPage />);

    expect(await screen.findByRole("button", { name: "+ Tạo lead" })).toBeInTheDocument();
  });

  it("creates a lead through the dialog and calls the API with form values", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.listLeads.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    leadsApi.createLead.mockResolvedValue(makeLead());
    renderWithProviders(<LeadsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "+ Tạo lead" }));
    await userEvent.type(screen.getByLabelText("Tên liên hệ *"), "Lê Văn B");
    await userEvent.click(screen.getByRole("button", { name: "Tạo lead" }));

    await waitFor(() => expect(leadsApi.createLead).toHaveBeenCalledWith(expect.objectContaining({ contactName: "Lê Văn B" })));
  });
});
