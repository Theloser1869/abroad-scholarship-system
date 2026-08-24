import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Enrollment } from "@/lib/enrollments/types";
import { EnrollmentDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const enrollmentsApi = vi.hoisted(() => ({
  getEnrollment: vi.fn(),
  updateEnrollment: vi.fn(),
  confirmEnrollment: vi.fn(),
  withdrawEnrollment: vi.fn(),
}));
vi.mock("@/lib/enrollments/api", () => enrollmentsApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
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

describe("EnrollmentDetailContent — only 2 dedicated FSM actions exist (confirm/withdraw), no generic status endpoint", () => {
  it("shows the forbidden state for a role without enrollment:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="enrollment" action="view">
        <EnrollmentDetailContent id="enr-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(enrollmentsApi.getEnrollment).not.toHaveBeenCalled();
  });

  it("confirms a PLANNED enrollment, surfacing 409 CONFIRMED_ENROLLMENT_EXISTS verbatim if another is already confirmed for the Case", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    enrollmentsApi.getEnrollment.mockResolvedValue(makeEnrollment({ status: "PLANNED" }));
    enrollmentsApi.confirmEnrollment.mockRejectedValue(
      new ApiError(409, { error: { code: "CONFIRMED_ENROLLMENT_EXISTS", message: "Already confirmed.", requestId: "r1", existingEnrollmentId: "enr-other" } }),
    );

    renderWithProviders(<EnrollmentDetailContent id="enr-1" />);
    await screen.findByRole("heading", { name: "Test University" });

    await userEvent.click(screen.getByRole("button", { name: "Xác nhận nhập học" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText("Case này đã có hồ sơ nhập học được xác nhận — cần rút hồ sơ đó trước.")).toBeInTheDocument();
  });

  it("withdraws via the shared ConfirmDialog (F09 hardening — no more window.confirm), no payload", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    enrollmentsApi.getEnrollment.mockResolvedValue(makeEnrollment({ status: "PLANNED" }));
    enrollmentsApi.withdrawEnrollment.mockResolvedValue(makeEnrollment({ status: "WITHDRAWN" }));

    renderWithProviders(<EnrollmentDetailContent id="enr-1" />);
    await screen.findByRole("heading", { name: "Test University" });

    await userEvent.click(screen.getByRole("button", { name: "Rút hồ sơ" }));
    expect(enrollmentsApi.withdrawEnrollment).not.toHaveBeenCalled();
    // Trigger button + the dialog's own confirm button share the label — the dialog's is second.
    await userEvent.click(screen.getAllByRole("button", { name: "Rút hồ sơ" })[1]);

    await waitFor(() => expect(enrollmentsApi.withdrawEnrollment).toHaveBeenCalledWith("enr-1"));
  });

  it("hides every action once WITHDRAWN (terminal)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    enrollmentsApi.getEnrollment.mockResolvedValue(makeEnrollment({ status: "WITHDRAWN" }));

    renderWithProviders(<EnrollmentDetailContent id="enr-1" />);
    await screen.findByRole("heading", { name: "Test University" });

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận nhập học" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rút hồ sơ" })).not.toBeInTheDocument();
  });

  it("STUDENT_PARENT sees internalNotes rendered exactly as returned (redacted to null), no edit/confirm/withdraw actions", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    enrollmentsApi.getEnrollment.mockResolvedValue(makeEnrollment({ status: "PLANNED", internalNotes: null }));

    renderWithProviders(<EnrollmentDetailContent id="enr-1" />);
    await screen.findByRole("heading", { name: "Test University" });

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xác nhận nhập học" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rút hồ sơ" })).not.toBeInTheDocument();
  });
});
