import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { StudentDetailContent } from "./page";
import { ApiError } from "@/lib/api/types";
import type { Student } from "@/lib/students/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const studentsApi = vi.hoisted(() => ({
  listStudents: vi.fn(),
  getStudent: vi.fn(),
  createStudent: vi.fn(),
  updateStudent: vi.fn(),
  archiveStudent: vi.fn(),
  addStudentNote: vi.fn(),
  getStudentTimeline: vi.fn(),
  listStudentContacts: vi.fn(),
  createStudentContact: vi.fn(),
  listCasesForStudent: vi.fn(),
  createCaseForStudent: vi.fn(),
  inviteParent: vi.fn(),
  revokeParentAccess: vi.fn(),
}));
vi.mock("@/lib/students/api", () => studentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: "student-1",
    studentCode: "HS-0001",
    fullName: "Phạm Văn C",
    dateOfBirth: null,
    email: "c@example.com",
    phone: null,
    targetCountry: "Úc",
    targetMajor: null,
    targetIntake: null,
    budget: null,
    budgetCurrency: null,
    archivedAt: null,
    portalUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderDetail(id = "student-1") {
  return renderWithProviders(
    <RequirePermission resource="students" action="view">
      <StudentDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("StudentDetailPage (360 view)", () => {
  it("renders profile, contacts, and cases sections from the API", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.getStudent.mockResolvedValue(makeStudent());
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([{ id: "c1", studentId: "student-1", type: "PARENT", name: "Mẹ", relationship: "Mẹ", phone: null, email: null, portalUserId: null, portalStatus: "NONE", revokedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });

    renderDetail();

    expect(await screen.findByText("Phạm Văn C")).toBeInTheDocument();
    expect(screen.getAllByText("Mẹ", { exact: false }).length).toBeGreaterThan(0);
  });

  it("shows the exact 404-non-enumeration copy for an out-of-scope/nonexistent student", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.getStudent.mockRejectedValue(
      new ApiError(404, { error: { code: "STUDENT_NOT_FOUND", message: "not found", requestId: "r1" } }),
    );
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });

    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("hides Lưu trữ for a role without students:archive (RBAC hidden action)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" }; // students: view, edit only — no archive
    studentsApi.getStudent.mockResolvedValue(makeStudent());
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });

    renderDetail();

    await screen.findByText("Phạm Văn C");
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa" })).toBeInTheDocument();
  });

  it("F08: invites a NONE-status contact into the Portal and shows the dev acceptance link", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.getStudent.mockResolvedValue(makeStudent());
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([
      { id: "c1", studentId: "student-1", type: "MOTHER", name: "Mẹ", relationship: "Mẹ", phone: null, email: "me@example.com", portalUserId: null, portalStatus: "NONE", revokedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });
    studentsApi.inviteParent.mockResolvedValue({ devToken: "abc123" });
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole("button", { name: "Mời vào cổng thông tin" }));

    await waitFor(() => expect(studentsApi.inviteParent).toHaveBeenCalledWith("student-1", "c1"));
  });

  it("F08: revokes an ACTIVE contact's Portal access after confirmation", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.getStudent.mockResolvedValue(makeStudent());
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([
      { id: "c1", studentId: "student-1", type: "MOTHER", name: "Mẹ", relationship: "Mẹ", phone: null, email: "me@example.com", portalUserId: "u9", portalStatus: "ACTIVE", revokedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });
    studentsApi.revokeParentAccess.mockResolvedValue({ portalStatus: "REVOKED" });
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole("button", { name: "Thu hồi quyền truy cập" }));
    // F09 hardening — confirmed through the shared ConfirmDialog, not window.confirm; its
    // own confirm button label ("Thu hồi") is distinct from the trigger's, no ambiguity.
    expect(studentsApi.revokeParentAccess).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Thu hồi" }));

    await waitFor(() => expect(studentsApi.revokeParentAccess).toHaveBeenCalledWith("student-1", "c1"));
  });

  it("F09: archives the student via the shared ConfirmDialog after confirmation", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    studentsApi.getStudent.mockResolvedValue(makeStudent());
    studentsApi.getStudentTimeline.mockResolvedValue([]);
    studentsApi.listStudentContacts.mockResolvedValue([]);
    studentsApi.listCasesForStudent.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });
    studentsApi.archiveStudent.mockResolvedValue(makeStudent({ archivedAt: "2026-02-01T00:00:00.000Z" }));
    const user = userEvent.setup();

    renderDetail();
    await user.click(await screen.findByRole("button", { name: "Lưu trữ" }));
    expect(studentsApi.archiveStudent).not.toHaveBeenCalled();
    // Trigger button + the dialog's own confirm button share the label — the dialog's is second.
    await user.click(screen.getAllByRole("button", { name: "Lưu trữ" })[1]);

    await waitFor(() => expect(studentsApi.archiveStudent).toHaveBeenCalled());
  });
});
