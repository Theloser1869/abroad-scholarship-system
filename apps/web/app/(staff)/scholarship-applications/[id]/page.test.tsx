import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { ScholarshipApplication } from "@/lib/scholarship-applications/types";
import { ScholarshipApplicationDetailContent } from "./page";

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
const applicationsApi = vi.hoisted(() => ({ listApplicationsForCase: vi.fn() }));
vi.mock("@/lib/applications/api", () => applicationsApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
  applicationsApi.listApplicationsForCase.mockResolvedValue({ data: [], meta: { page: 1, limit: 100, totalItems: 0, totalPages: 0 } });
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

describe("ScholarshipApplicationDetailContent", () => {
  it("shows the forbidden state for a role without scholarship_applications:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="scholarship_applications" action="view">
        <ScholarshipApplicationDetailContent id="sa-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(scholarshipApplicationsApi.getScholarshipApplication).not.toHaveBeenCalled();
  });

  it("shows the eligibility gate as unconfirmed and offers the confirm action", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ eligibilityConfirmed: false }));

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);

    expect(await screen.findByText(/Chưa xác nhận/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xác nhận đủ điều kiện" })).toBeInTheDocument();
  });

  it("attempting SUBMITTED before eligibility confirmation surfaces 409 ELIGIBILITY_NOT_CONFIRMED verbatim, never pre-blocked client-side", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ eligibilityConfirmed: false, status: "PLANNING" }));
    scholarshipApplicationsApi.updateScholarshipApplicationStatus.mockRejectedValue(
      new ApiError(409, { error: { code: "ELIGIBILITY_NOT_CONFIRMED", message: "Eligibility must be confirmed before submitting.", requestId: "r1" } }),
    );

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);
    await screen.findByRole("heading", { name: "Merit Scholarship" });

    await userEvent.click(screen.getByRole("button", { name: "Chuyển trạng thái" }));
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái mới"), "SUBMITTED");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText(/Cần xác nhận đủ điều kiện/)).toBeInTheDocument();
  });

  it("awards the scholarship from UNDER_REVIEW, recording amount/currency, never creating a Contract/Payment record", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ status: "UNDER_REVIEW", eligibilityConfirmed: true }));
    scholarshipApplicationsApi.awardScholarship.mockResolvedValue(makeScholarshipApplication({ status: "AWARDED", awardAmount: "5000.00", awardCurrency: "USD" }));

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);
    await screen.findByRole("heading", { name: "Merit Scholarship" });

    await userEvent.click(screen.getByRole("button", { name: "Trao học bổng" }));
    const awardAmountInputs = screen.getAllByLabelText("Giá trị");
    await userEvent.type(awardAmountInputs[awardAmountInputs.length - 1], "5000");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận trao học bổng" }));

    await waitFor(() => expect(scholarshipApplicationsApi.awardScholarship).toHaveBeenCalledWith("sa-1", expect.objectContaining({ awardAmount: 5000 })));
  });

  it("rejects from UNDER_REVIEW/INTERVIEW via the dedicated action, confirmed through the shared ConfirmDialog (F09 — no more window.confirm)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ status: "INTERVIEW", eligibilityConfirmed: true }));
    scholarshipApplicationsApi.rejectScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ status: "REJECTED" }));

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);
    await screen.findByRole("heading", { name: "Merit Scholarship" });

    await userEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    expect(scholarshipApplicationsApi.rejectScholarshipApplication).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Từ chối" })[1]);

    await waitFor(() => expect(scholarshipApplicationsApi.rejectScholarshipApplication).toHaveBeenCalledWith("sa-1"));
  });

  it("hides Trao học bổng/Từ chối once AWARDED (terminal) and shows the award result", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(
      makeScholarshipApplication({ status: "AWARDED", eligibilityConfirmed: true, awardAmount: "5000.00", awardCurrency: "USD", awardCoverageType: "Full tuition" }),
    );

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);
    await screen.findByRole("heading", { name: "Merit Scholarship" });

    expect(screen.queryByRole("button", { name: "Trao học bổng" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
    expect(screen.getByText("Full tuition")).toBeInTheDocument();
  });

  it("STUDENT_PARENT sees internalNotes rendered exactly as returned (redacted to null), never a client workaround", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    scholarshipApplicationsApi.getScholarshipApplication.mockResolvedValue(makeScholarshipApplication({ internalNotes: null }));

    renderWithProviders(<ScholarshipApplicationDetailContent id="sa-1" />);
    await screen.findByRole("heading", { name: "Merit Scholarship" });

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận đủ điều kiện" })).not.toBeInTheDocument();
  });
});
