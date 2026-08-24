import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Application } from "@/lib/applications/types";
import { CaseApplicationsContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const applicationsApi = vi.hoisted(() => ({
  listApplicationsForCase: vi.fn(),
  getApplication: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  submitApplication: vi.fn(),
  updateApplicationStatus: vi.fn(),
  listChecklistItems: vi.fn(),
  createChecklistItem: vi.fn(),
  updateChecklistItem: vi.fn(),
}));
vi.mock("@/lib/applications/api", () => applicationsApi);
const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);
const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "CASE-2026-00001" });
  programsApi.listPrograms.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    applicationCode: "APP-2026-00001",
    studentId: "student-1",
    caseId: "case-1",
    programId: "prog-1",
    program: { id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science", university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" } },
    intendedIntake: "Fall 2027",
    deadline: null,
    status: "PLANNING",
    submittedAt: null,
    submissionChannel: null,
    submissionReference: null,
    evidenceDocumentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseApplicationsContent (list)", () => {
  it("shows the forbidden state for a role without applications:view (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="applications" action="view">
        <CaseApplicationsContent caseId="case-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(applicationsApi.listApplicationsForCase).not.toHaveBeenCalled();
  });

  it("renders the university/program via the DEC-11 embed", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.listApplicationsForCase.mockResolvedValue({ data: [makeApplication()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<CaseApplicationsContent caseId="case-1" />);

    expect(await screen.findByText("APP-2026-00001")).toBeInTheDocument();
    expect(screen.getByText(/University of Testing/)).toBeInTheDocument();
  });

  it("creates an Application and surfaces a 409 ACTIVE_APPLICATION_EXISTS conflict verbatim, never a separate pre-check request", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.listApplicationsForCase.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    programsApi.listPrograms.mockResolvedValue({
      data: [{ id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science", university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" } }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    applicationsApi.createApplication.mockRejectedValue(
      new ApiError(409, {
        error: { code: "ACTIVE_APPLICATION_EXISTS", message: "This student already has an active application.", requestId: "r1", existingApplicationId: "app-existing" },
      }),
    );

    renderWithProviders(<CaseApplicationsContent caseId="case-1" />);
    await screen.findByText("Chưa có hồ sơ ứng tuyển nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo hồ sơ" }));
    await userEvent.type(screen.getByPlaceholderText("Tìm theo ngành, trường..."), "Computer");
    await userEvent.click(await screen.findByRole("button", { name: /Computer Science/ }));
    await userEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));

    expect(await screen.findByText(/đã có hồ sơ ứng tuyển đang hoạt động/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem hồ sơ đang hoạt động →" })).toHaveAttribute("href", "/applications/app-existing");
  });

  it("filters by status and re-queries with the selected status", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.listApplicationsForCase.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });

    renderWithProviders(<CaseApplicationsContent caseId="case-1" />);
    await screen.findByText("Chưa có hồ sơ ứng tuyển nào.");

    await userEvent.selectOptions(screen.getByLabelText("Lọc theo trạng thái"), "SUBMITTED");

    await waitFor(() => expect(applicationsApi.listApplicationsForCase).toHaveBeenCalledWith("case-1", expect.objectContaining({ status: "SUBMITTED" })));
  });
});
