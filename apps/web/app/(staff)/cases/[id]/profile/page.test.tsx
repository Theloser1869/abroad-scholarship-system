import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import { CaseProfileContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);

const profileApi = vi.hoisted(() => ({
  listAcademicRecordsForCase: vi.fn(),
  createAcademicRecord: vi.fn(),
  updateAcademicRecord: vi.fn(),
  verifyAcademicRecord: vi.fn(),
  listTestRecordsForCase: vi.fn(),
  createTestRecord: vi.fn(),
  updateTestRecord: vi.fn(),
  verifyTestRecord: vi.fn(),
  listCompetitionsForCase: vi.fn(),
  createCompetition: vi.fn(),
  updateCompetition: vi.fn(),
  listResearchProjectsForCase: vi.fn(),
  createResearchProject: vi.fn(),
  updateResearchProject: vi.fn(),
  listActivitiesForCase: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  verifyActivity: vi.fn(),
}));
vi.mock("@/lib/profile-evidence/api", () => profileApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "C-0001" });
  profileApi.listAcademicRecordsForCase.mockResolvedValue([]);
  profileApi.listTestRecordsForCase.mockResolvedValue([]);
  profileApi.listCompetitionsForCase.mockResolvedValue([]);
  profileApi.listResearchProjectsForCase.mockResolvedValue([]);
  profileApi.listActivitiesForCase.mockResolvedValue([]);
});

function renderPage(caseId = "case-1") {
  return renderWithProviders(
    <RequirePermission resource="profile_evidence" action="view">
      <CaseProfileContent caseId={caseId} />
    </RequirePermission>,
  );
}

describe("CaseProfilePage", () => {
  it("shows the forbidden state for a role without profile_evidence:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderPage();
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
  });

  it("renders the Academic tab by default and its records", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    profileApi.listAcademicRecordsForCase.mockResolvedValue([
      { id: "a1", caseId: "case-1", school: "ABC High", period: "Grade 11", gpa: "3.8", gradingScale: "4.0", evidenceDocumentId: null, verifiedById: null, verifiedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    renderPage();

    expect(await screen.findByText("ABC High · Grade 11")).toBeInTheDocument();
  });

  it("switches to the Test tab and shows a duplicate-attempt conflict verbatim, never silently merged", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    profileApi.createTestRecord.mockRejectedValue(
      new ApiError(409, { error: { code: "DUPLICATE_TEST_ATTEMPT", message: "dup", requestId: "r1" } }),
    );

    renderPage();
    await screen.findByText("Học tập");
    await userEvent.click(screen.getByRole("button", { name: "Bài thi chuẩn hóa" }));
    await screen.findByText("Chưa có kết quả bài thi nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Thêm lượt thi" }));
    await userEvent.type(screen.getByLabelText("Loại bài thi *"), "IELTS");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Đã tồn tại lượt thi này (cùng loại bài thi và số lần thi).")).toBeInTheDocument();
  });

  it("hides every '+ Thêm' create button for DOCUMENT_SPECIALIST (profile_evidence:view only)", async () => {
    authState.principal = { userId: "u1", roleCode: "DOCUMENT_SPECIALIST" };

    renderPage();
    await screen.findByText("Học tập");

    expect(screen.queryByRole("button", { name: "+ Thêm hồ sơ học tập" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Hoạt động / Lãnh đạo" }));
    expect(screen.queryByRole("button", { name: "+ Thêm hoạt động" })).not.toBeInTheDocument();
  });

  it("renders Competition/Research/Activity tabs from their real backend fields", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    profileApi.listCompetitionsForCase.mockResolvedValue([
      { id: "c1", competitionCode: "COMP-2026-00001", caseId: "case-1", eventName: "Olympic Toán", year: 2026, season: null, category: null, registrationStatus: null, preparation: null, result: null, rank: "1", award: "Gold", evidenceDocumentId: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    renderPage();
    await screen.findByText("Học tập");
    await userEvent.click(screen.getByRole("button", { name: "Thi đấu" }));

    expect(await screen.findByText("Olympic Toán (2026)")).toBeInTheDocument();
  });
});
