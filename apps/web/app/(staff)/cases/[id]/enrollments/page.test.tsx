import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Enrollment } from "@/lib/enrollments/types";
import { CaseEnrollmentsContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const enrollmentsApi = vi.hoisted(() => ({ listEnrollmentsForCase: vi.fn(), createEnrollment: vi.fn() }));
vi.mock("@/lib/enrollments/api", () => enrollmentsApi);
const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "CASE-2026-00001" });
});

function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: "enr-1",
    studentId: "student-1",
    caseId: "case-1",
    offerId: "offer-1",
    universityId: "uni-1",
    university: { id: "uni-1", officialName: "Test University", countryCode: "US" },
    programId: "prog-1",
    program: { id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science" },
    startDate: null,
    confirmationDate: null,
    status: "PLANNED",
    evidenceDocumentId: null,
    internalNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseEnrollmentsContent — universityId/programId are always derived server-side from the Offer, never client-supplied", () => {
  it("shows the forbidden state for a role without enrollment:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="enrollment" action="view">
        <CaseEnrollmentsContent caseId="case-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(enrollmentsApi.listEnrollmentsForCase).not.toHaveBeenCalled();
  });

  it("renders the case's enrollment list with the embedded University/Program summary", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    enrollmentsApi.listEnrollmentsForCase.mockResolvedValue([makeEnrollment()]);

    renderWithProviders(<CaseEnrollmentsContent caseId="case-1" />);

    expect(await screen.findByText("Test University")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
  });

  it("creates an enrollment from an offerId, surfacing 409 INVALID_ENROLLMENT_TARGET verbatim if the offer isn't a valid ACCEPTED target", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    enrollmentsApi.listEnrollmentsForCase.mockResolvedValue([]);
    enrollmentsApi.createEnrollment.mockRejectedValue(
      new ApiError(409, { error: { code: "INVALID_ENROLLMENT_TARGET", message: "Invalid target.", requestId: "r1" } }),
    );

    renderWithProviders(<CaseEnrollmentsContent caseId="case-1" />);
    await screen.findByText("Chưa có hồ sơ nhập học nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo hồ sơ nhập học" }));
    await userEvent.type(screen.getByLabelText("Offer ID *"), "offer-not-accepted");
    await userEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));

    await waitFor(() => expect(enrollmentsApi.createEnrollment).toHaveBeenCalledWith("case-1", expect.objectContaining({ offerId: "offer-not-accepted" })));
    expect(await screen.findByText("Thư mời được chọn không hợp lệ để nhập học (chỉ chấp nhận thư mời đã được chấp nhận).")).toBeInTheDocument();
  });
});
