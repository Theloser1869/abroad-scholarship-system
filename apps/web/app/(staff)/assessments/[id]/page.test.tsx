import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Assessment } from "@/lib/assessments/types";
import { AssessmentDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const assessmentsApi = vi.hoisted(() => ({
  getAssessment: vi.fn(),
  submitAssessment: vi.fn(),
  approveAssessment: vi.fn(),
  rejectAssessment: vi.fn(),
  upsertCriterion: vi.fn(),
}));
vi.mock("@/lib/assessments/api", () => assessmentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: "assessment-1",
    caseId: "case-1",
    version: 1,
    status: "DRAFT",
    changeReason: null,
    approvedById: null,
    approvedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    criteria: [
      {
        id: "criterion-1",
        assessmentId: "assessment-1",
        area: "Academic",
        currentScore: "7.5",
        targetScore: "9.0",
        gap: "1.5",
        priority: "High",
        recommendation: null,
        evidenceDocumentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderDetail(id = "assessment-1") {
  return renderWithProviders(
    <RequirePermission resource="assessments" action="view">
      <AssessmentDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("AssessmentDetailPage", () => {
  it("renders version/status and criteria with the backend's own gap value, never recomputed", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    assessmentsApi.getAssessment.mockResolvedValue(makeAssessment());

    renderDetail();

    expect(await screen.findByText("Đánh giá năng lực — Phiên bản 1")).toBeInTheDocument();
    expect(screen.getByText("Academic")).toBeInTheDocument();
    expect(screen.getByText("1.5")).toBeInTheDocument();
  });

  it("shows the exact 404-non-enumeration copy for an out-of-scope/nonexistent assessment", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    assessmentsApi.getAssessment.mockRejectedValue(new ApiError(404, { error: { code: "ASSESSMENT_NOT_FOUND", message: "nf", requestId: "r1" } }));

    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("hides Duyệt/Từ chối for CONSULTANT (assessments:approve is ED/DM-only) even while REVIEW", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    assessmentsApi.getAssessment.mockResolvedValue(makeAssessment({ status: "REVIEW" }));

    renderDetail();
    await screen.findByText(/Phiên bản 1/);

    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("upserts a criterion by area and never sends a computed gap in the request body", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    assessmentsApi.getAssessment.mockResolvedValue(makeAssessment());
    assessmentsApi.upsertCriterion.mockResolvedValue({ ...makeAssessment().criteria[0], targetScore: "9.5" });

    renderDetail();
    await screen.findByText("Academic");

    await userEvent.click(screen.getByRole("button", { name: "Sửa" }));
    const targetInput = screen.getByLabelText("Điểm mục tiêu");
    await userEvent.clear(targetInput);
    await userEvent.type(targetInput, "9.5");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(assessmentsApi.upsertCriterion).toHaveBeenCalledWith("assessment-1", expect.objectContaining({ area: "Academic", targetScore: 9.5 })));
    const sentInput = assessmentsApi.upsertCriterion.mock.calls[0][1];
    expect(sentInput).not.toHaveProperty("gap");
  });

  it("REVIEW → REVIEW rejection requires a reason and surfaces the rejected-to-draft outcome", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    assessmentsApi.getAssessment.mockResolvedValue(makeAssessment({ status: "REVIEW" }));
    assessmentsApi.rejectAssessment.mockResolvedValue(makeAssessment({ status: "DRAFT" }));

    renderDetail();
    await screen.findByText(/Phiên bản 1/);

    await userEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    expect(screen.getByRole("button", { name: "Xác nhận" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Lý do từ chối *"), "Thiếu minh chứng");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(assessmentsApi.rejectAssessment).toHaveBeenCalledWith("assessment-1", "Thiếu minh chứng"));
  });
});
