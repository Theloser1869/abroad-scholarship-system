import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { ScholarshipMaster } from "@/lib/scholarship-masters/types";
import ScholarshipMastersPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const scholarshipMastersApi = vi.hoisted(() => ({
  listScholarshipMasters: vi.fn(),
  getScholarshipMaster: vi.fn(),
  createScholarshipMaster: vi.fn(),
  updateScholarshipMaster: vi.fn(),
  verifyScholarshipMaster: vi.fn(),
}));
vi.mock("@/lib/scholarship-masters/api", () => scholarshipMastersApi);
const universitiesApi = vi.hoisted(() => ({ listUniversities: vi.fn() }));
vi.mock("@/lib/universities/api", () => universitiesApi);
const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);

beforeEach(() => {
  vi.resetAllMocks();
  universitiesApi.listUniversities.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
  programsApi.listPrograms.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeScholarshipMaster(overrides: Partial<ScholarshipMaster> = {}): ScholarshipMaster {
  return {
    id: "sch-master-1",
    scholarshipCode: "SCHM-2026-00001",
    provider: "Test Foundation",
    name: "Merit Scholarship",
    universityId: null,
    programId: null,
    eligibility: null,
    coverageType: "Full tuition",
    amount: "20000.00",
    percentage: null,
    amountCurrency: "USD",
    deadline: null,
    requiredDocuments: null,
    conditions: null,
    source: null,
    sourceUrl: null,
    externalId: null,
    retrievedAt: null,
    syncStatus: "NOT_SYNCED",
    status: "ACTIVE",
    lastVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ScholarshipMastersPage (list)", () => {
  it("renders the scholarship master catalog, distinct from any ScholarshipApplication concept", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    scholarshipMastersApi.listScholarshipMasters.mockResolvedValue({ data: [makeScholarshipMaster()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<ScholarshipMastersPage />);

    expect(await screen.findByText("SCHM-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Merit Scholarship")).toBeInTheDocument();
    expect(screen.getByText("Test Foundation")).toBeInTheDocument();
  });

  it("creates a scholarship master via the dialog", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    scholarshipMastersApi.listScholarshipMasters.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    scholarshipMastersApi.createScholarshipMaster.mockResolvedValue(makeScholarshipMaster());

    renderWithProviders(<ScholarshipMastersPage />);
    await screen.findByText("Không có học bổng nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo học bổng" }));
    await userEvent.type(screen.getByLabelText("Đơn vị cấp *"), "New Foundation");
    await userEvent.type(screen.getByLabelText("Tên học bổng *"), "New Scholarship");
    await userEvent.click(screen.getByRole("button", { name: "Tạo học bổng" }));

    await waitFor(() =>
      expect(scholarshipMastersApi.createScholarshipMaster).toHaveBeenCalledWith(expect.objectContaining({ provider: "New Foundation", name: "New Scholarship" })),
    );
  });
});
