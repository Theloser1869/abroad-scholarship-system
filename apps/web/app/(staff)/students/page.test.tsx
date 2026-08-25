import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import StudentsPage from "./page";
import { ApiError } from "@/lib/api/types";
import type { Student } from "@/lib/students/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
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
    scholarshipGoal: null,
    budget: null,
    budgetCurrency: null,
    archivedAt: null,
    portalUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("StudentsPage — list", () => {
  it("shows the forbidden state for a role without students:view", () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(<StudentsPage />);

    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
    expect(studentsApi.listStudents).not.toHaveBeenCalled();
  });

  it("renders students from the API", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.listStudents.mockResolvedValue({
      data: [makeStudent()],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderWithProviders(<StudentsPage />);

    expect(await screen.findByText("HS-0001")).toBeInTheDocument();
    expect(screen.getByText("Phạm Văn C")).toBeInTheDocument();
  });

  it("shows the exact 404-non-enumeration copy when the list call itself is scope-denied", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    studentsApi.listStudents.mockRejectedValue(
      new ApiError(404, { error: { code: "NOT_FOUND", message: "not found", requestId: "r1" } }),
    );
    renderWithProviders(<StudentsPage />);

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("redacted budget (null from FieldPolicyService) never crashes the list — renders whatever the API returned, nothing invented", async () => {
    authState.principal = { userId: "u1", roleCode: "DOCUMENT_SPECIALIST" };
    studentsApi.listStudents.mockResolvedValue({
      data: [makeStudent({ budget: null, budgetCurrency: null })],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderWithProviders(<StudentsPage />);

    expect(await screen.findByText("HS-0001")).toBeInTheDocument();
  });
});
