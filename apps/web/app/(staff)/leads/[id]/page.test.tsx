import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { LeadDetailContent } from "./page";
import { ApiError } from "@/lib/api/types";
import type { Lead } from "@/lib/leads/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));
// LeadConvertDialog calls useRouter() unconditionally (not just when open) to navigate to
// the new Case on success — needs a mocked next/navigation router even for tests that never
// open it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

const leadsApi = vi.hoisted(() => ({
  listLeads: vi.fn(),
  getLead: vi.fn(),
  createLead: vi.fn(),
  updateLead: vi.fn(),
  updateLeadStatus: vi.fn(),
  assignLeadOwner: vi.fn(),
  convertLead: vi.fn(),
  addLeadNote: vi.fn(),
  getLeadTimeline: vi.fn(),
}));
vi.mock("@/lib/leads/api", () => leadsApi);

const OWNER = { id: "owner-1", username: "sales1", fullName: "Nguyễn Sale" };

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    leadCode: "L-0001",
    contactName: "Trần Thị A",
    parentName: null,
    email: "a@example.com",
    phone: null,
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

// Renders exactly what `LeadDetailPage`'s default export renders once `params` resolves —
// the route wrapper itself is a thin `use(params)`/`<Suspense>` shell (Next.js routing
// mechanics only); the RBAC gate + data-fetching + terminal-state logic under test lives in
// `LeadDetailContent`, rendered here with the same `RequirePermission` boundary the real page
// wraps it in.
function renderDetail(id = "lead-1") {
  return renderWithProviders(
    <RequirePermission resource="leads" action="view">
      <LeadDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("LeadDetailPage", () => {
  it("renders lead details once loaded, including owner name", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.getLead.mockResolvedValue(makeLead());
    leadsApi.getLeadTimeline.mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByText("Trần Thị A")).toBeInTheDocument();
    expect(screen.getByText(OWNER.fullName)).toBeInTheDocument();
  });

  it("shows the exact 404-non-enumeration copy for a nonexistent/out-of-scope lead — never a different message for either case", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.getLead.mockRejectedValue(
      new ApiError(404, { error: { code: "LEAD_NOT_FOUND", message: "Lead x not found.", requestId: "r1" } }),
    );
    leadsApi.getLeadTimeline.mockResolvedValue([]);
    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
    expect(screen.queryByText(/tồn tại nhưng/)).not.toBeInTheDocument();
  });

  it("shows the forbidden state for a role with no leads grant at all — never the lead's data", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" }; // no leads grants at all
    leadsApi.getLead.mockResolvedValue(makeLead());
    leadsApi.getLeadTimeline.mockResolvedValue([]);
    renderDetail();

    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
    expect(screen.queryByText("Trần Thị A")).not.toBeInTheDocument();
    expect(leadsApi.getLead).not.toHaveBeenCalled();
  });

  it("hides status-transition and convert actions once the lead is in a terminal state (CONVERTED)", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    leadsApi.getLead.mockResolvedValue(makeLead({ status: "CONVERTED" }));
    leadsApi.getLeadTimeline.mockResolvedValue([]);
    renderDetail();

    await screen.findByText("Trần Thị A");
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chuyển đổi/ })).not.toBeInTheDocument();
    // Edit/assign remain available regardless of terminal status (backend is the real gate).
    expect(screen.getByRole("button", { name: "Sửa" })).toBeInTheDocument();
  });
});
