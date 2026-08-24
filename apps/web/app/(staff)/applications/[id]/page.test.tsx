import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { ApplicationDetail } from "@/lib/applications/types";
import { ApplicationDetailContent } from "./page";

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
const offersApi = vi.hoisted(() => ({ listOffersForApplication: vi.fn(), getCurrentOffer: vi.fn(), getOffer: vi.fn(), createOffer: vi.fn(), respondToOffer: vi.fn() }));
vi.mock("@/lib/offers/api", () => offersApi);
const usersApi = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock("@/lib/users/api", () => usersApi);

beforeEach(() => {
  vi.resetAllMocks();
  offersApi.getCurrentOffer.mockResolvedValue(null);
  usersApi.listUsers.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeApplication(overrides: Partial<ApplicationDetail> = {}): ApplicationDetail {
  return {
    id: "app-1",
    applicationCode: "APP-2026-00001",
    studentId: "student-1",
    caseId: "case-1",
    programId: "prog-1",
    program: { id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science", university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" } },
    intendedIntake: "Fall 2027",
    deadline: null,
    status: "READY_FOR_REVIEW",
    submittedAt: null,
    submissionChannel: null,
    submissionReference: null,
    evidenceDocumentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    checklist: [],
    offers: [],
    scholarshipApplications: [],
    ...overrides,
  };
}

describe("ApplicationDetailContent", () => {
  it("shows the forbidden state for a role without applications:view (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="applications" action="view">
        <ApplicationDetailContent id="app-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(applicationsApi.getApplication).not.toHaveBeenCalled();
  });

  it("renders the embedded checklist with required/status markers", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.getApplication.mockResolvedValue(
      makeApplication({
        checklist: [
          { id: "item-1", applicationId: "app-1", title: "Transcript", required: true, ownerId: null, deadline: null, status: "PENDING", documentId: null, notes: null, completedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    );

    renderWithProviders(<ApplicationDetailContent id="app-1" />);

    expect((await screen.findAllByText("Transcript")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bắt buộc").length).toBeGreaterThan(0);
  });

  it("submitting surfaces a 409 CHECKLIST_INCOMPLETE conflict verbatim, never a client-side checklist precheck", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.getApplication.mockResolvedValue(makeApplication({ status: "READY_FOR_REVIEW" }));
    applicationsApi.submitApplication.mockRejectedValue(
      new ApiError(409, { error: { code: "CHECKLIST_INCOMPLETE", message: "1 required checklist item(s) are not yet DONE or WAIVED.", requestId: "r1" } }),
    );

    renderWithProviders(<ApplicationDetailContent id="app-1" />);
    await screen.findByText("APP-2026-00001");

    await userEvent.click(screen.getByRole("button", { name: "Nộp hồ sơ" }));
    // Once the dialog is open, both the header action button and the dialog's own submit
    // button share the label "Nộp hồ sơ" — the dialog's is the second one in document order.
    const submitButtons = await screen.findAllByRole("button", { name: "Nộp hồ sơ" });
    await userEvent.click(submitButtons[submitButtons.length - 1]);

    expect(await screen.findByText(/checklist bắt buộc chưa hoàn tất/)).toBeInTheDocument();
  });

  it("changes status via the dedicated action and surfaces the allowedTransitions on a 409 conflict", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.getApplication.mockResolvedValue(makeApplication({ status: "PLANNING" }));
    applicationsApi.updateApplicationStatus.mockRejectedValue(
      new ApiError(409, {
        error: { code: "INVALID_APPLICATION_STATUS_TRANSITION", message: "Cannot move Application from PLANNING to REJECT.", requestId: "r1", allowedTransitions: ["PREPARING", "WITHDRAWN"] },
      }),
    );

    renderWithProviders(<ApplicationDetailContent id="app-1" />);
    await screen.findByText("APP-2026-00001");

    await userEvent.click(screen.getByRole("button", { name: "Chuyển trạng thái" }));
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái hồ sơ mới"), "REJECT");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText(/Không thể chuyển hồ sơ ứng tuyển sang trạng thái này/)).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái hợp lệ tiếp theo/)).toBeInTheDocument();
  });

  it("hides Nộp hồ sơ once already SUBMITTED (dedicated action only reachable from READY_FOR_REVIEW)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    applicationsApi.getApplication.mockResolvedValue(makeApplication({ status: "SUBMITTED", submittedAt: "2026-01-05T00:00:00.000Z" }));

    renderWithProviders(<ApplicationDetailContent id="app-1" />);
    await screen.findByText("APP-2026-00001");

    expect(screen.queryByRole("button", { name: "Nộp hồ sơ" })).not.toBeInTheDocument();
  });

  it("STUDENT_PARENT (view-only) sees no action buttons at all", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    applicationsApi.getApplication.mockResolvedValue(makeApplication({ status: "READY_FOR_REVIEW" }));

    renderWithProviders(<ApplicationDetailContent id="app-1" />);
    await screen.findByText("APP-2026-00001");

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nộp hồ sơ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
  });
});
