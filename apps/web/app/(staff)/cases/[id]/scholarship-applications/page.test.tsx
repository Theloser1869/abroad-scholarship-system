import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { ScholarshipApplication } from "@/lib/scholarship-applications/types";
import { CaseScholarshipApplicationsContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const scholarshipApplicationsApi = vi.hoisted(() => ({
  listScholarshipApplicationsForCase: vi.fn(),
  getScholarshipApplication: vi.fn(),
  createScholarshipApplication: vi.fn(),
  updateScholarshipApplication: vi.fn(),
  confirmScholarshipEligibility: vi.fn(),
  updateScholarshipApplicationStatus: vi.fn(),
  awardScholarship: vi.fn(),
  rejectScholarshipApplication: vi.fn(),
}));
vi.mock("@/lib/scholarship-applications/api", () => scholarshipApplicationsApi);
const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);
const applicationsApi = vi.hoisted(() => ({ listApplicationsForCase: vi.fn() }));
vi.mock("@/lib/applications/api", () => applicationsApi);
const scholarshipMastersApi = vi.hoisted(() => ({ listScholarshipMasters: vi.fn() }));
vi.mock("@/lib/scholarship-masters/api", () => scholarshipMastersApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "CASE-2026-00001" });
  applicationsApi.listApplicationsForCase.mockResolvedValue({ data: [], meta: { page: 1, limit: 100, totalItems: 0, totalPages: 0 } });
  scholarshipMastersApi.listScholarshipMasters.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeScholarshipApplication(overrides: Partial<ScholarshipApplication> = {}): ScholarshipApplication {
  return {
    id: "sa-1",
    scholarshipApplicationCode: "SCH-2026-00001",
    studentId: "student-1",
    caseId: "case-1",
    scholarshipMasterId: "sch-master-1",
    scholarshipMaster: { id: "sch-master-1", scholarshipCode: "SCHM-2026-00001", provider: "Test Foundation", name: "Merit Scholarship", coverageType: null, amount: null, percentage: null, amountCurrency: null },
    applicationId: null,
    status: "PLANNING",
    eligibilityConfirmed: false,
    eligibilityNotes: null,
    deadline: null,
    essayArtifactId: null,
    interviewAt: null,
    internalNotes: null,
    conditions: null,
    awardAmount: null,
    awardCurrency: null,
    awardCoverageType: null,
    awardPeriod: null,
    awardAcceptanceDeadline: null,
    evidenceDocumentId: null,
    submittedAt: null,
    decidedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseScholarshipApplicationsContent (list, distinct from ScholarshipMaster)", () => {
  it("shows the forbidden state for a role without scholarship_applications:view (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="scholarship_applications" action="view">
        <CaseScholarshipApplicationsContent caseId="case-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(scholarshipApplicationsApi.listScholarshipApplicationsForCase).not.toHaveBeenCalled();
  });

  it("renders the ScholarshipMaster summary via the DEC-11 embed", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    scholarshipApplicationsApi.listScholarshipApplicationsForCase.mockResolvedValue([makeScholarshipApplication()]);

    renderWithProviders(<CaseScholarshipApplicationsContent caseId="case-1" />);

    expect(await screen.findByText("SCH-2026-00001")).toBeInTheDocument();
    expect(screen.getByText(/Merit Scholarship/)).toBeInTheDocument();
    expect(screen.getByText(/Test Foundation/)).toBeInTheDocument();
  });

  it("shows the empty state when there are no scholarship applications", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    scholarshipApplicationsApi.listScholarshipApplicationsForCase.mockResolvedValue([]);

    renderWithProviders(<CaseScholarshipApplicationsContent caseId="case-1" />);

    expect(await screen.findByText("Chưa có hồ sơ học bổng nào.")).toBeInTheDocument();
  });
});
