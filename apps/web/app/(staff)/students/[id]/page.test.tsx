import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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
});
