import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { UniversityChoice } from "@/lib/university-choices/types";
import { StudentUniversityChoicesContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const universityChoicesApi = vi.hoisted(() => ({
  listUniversityChoicesForStudent: vi.fn(),
  getUniversityChoice: vi.fn(),
  createUniversityChoice: vi.fn(),
  updateUniversityChoice: vi.fn(),
  reviewUniversityChoice: vi.fn(),
}));
vi.mock("@/lib/university-choices/api", () => universityChoicesApi);
const studentsApi = vi.hoisted(() => ({ getStudent: vi.fn() }));
vi.mock("@/lib/students/api", () => studentsApi);
const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);

beforeEach(() => {
  vi.resetAllMocks();
  studentsApi.getStudent.mockResolvedValue({ id: "student-1", fullName: "Trần Văn A", studentCode: "HS-2026-00001" });
  programsApi.listPrograms.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeChoice(overrides: Partial<UniversityChoice> = {}): UniversityChoice {
  return {
    id: "choice-1",
    studentId: "student-1",
    caseId: null,
    programId: "prog-1",
    program: { id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science", university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" } },
    tier: "MATCH",
    rationale: "Solid fit.",
    status: "PROPOSED",
    ownerId: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("StudentUniversityChoicesPage (student-scoped, not case-scoped)", () => {
  it("shows the forbidden state for a role without university_choices:view (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="university_choices" action="view">
        <StudentUniversityChoicesContent studentId="student-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(universityChoicesApi.listUniversityChoicesForStudent).not.toHaveBeenCalled();
  });

  it("lists the student's Reach/Match/Safety choices with tier and status", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    universityChoicesApi.listUniversityChoicesForStudent.mockResolvedValue([makeChoice()]);

    renderWithProviders(<StudentUniversityChoicesContent studentId="student-1" />);

    // The per-row edit dialog is always mounted (closed) and its read-only "Chương trình"
    // summary repeats the same text — getAllByText/length, not getByText, since happy-dom
    // doesn't hide closed <dialog> content the way getByRole does (F04's established fix
    // for this exact ambiguity shape).
    expect((await screen.findAllByText(/Computer Science/)).length).toBeGreaterThan(0);
    // Also collides with the edit dialog's tier <select><option> — same ambiguity shape.
    expect(screen.getAllByText("Phù hợp (Match)").length).toBeGreaterThan(0);
  });

  it("STUDENT_PARENT (view-only) never sees the status <select> or edit/review actions", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    universityChoicesApi.listUniversityChoicesForStudent.mockResolvedValue([makeChoice()]);

    renderWithProviders(<StudentUniversityChoicesContent studentId="student-1" />);
    await screen.findAllByText(/Computer Science/);

    expect(screen.queryByLabelText("Trạng thái lựa chọn")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Thêm lựa chọn" })).not.toBeInTheDocument();
  });

  it("adds a choice and surfaces a 409 DUPLICATE_UNIVERSITY_CHOICE conflict without a link (no standalone detail route)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    universityChoicesApi.listUniversityChoicesForStudent.mockResolvedValue([]);
    programsApi.listPrograms.mockResolvedValue({
      data: [{ id: "prog-1", degreeLevel: "Bachelor", major: "Computer Science", university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" } }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    universityChoicesApi.createUniversityChoice.mockRejectedValue(
      new ApiError(409, { error: { code: "DUPLICATE_UNIVERSITY_CHOICE", message: "This student already has a choice for this program.", requestId: "r1", existingUniversityChoiceId: "choice-existing" } }),
    );

    renderWithProviders(<StudentUniversityChoicesContent studentId="student-1" />);
    await screen.findByText("Chưa có lựa chọn trường nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Thêm lựa chọn" }));
    await userEvent.type(screen.getByPlaceholderText("Tìm theo ngành, trường..."), "Computer");
    await userEvent.click(await screen.findByRole("button", { name: /Computer Science/ }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));

    expect(await screen.findByText(/đã có lựa chọn/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xem/ })).not.toBeInTheDocument();
  });

  it("changes tier/status via update and calls updateUniversityChoice", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    universityChoicesApi.listUniversityChoicesForStudent.mockResolvedValue([makeChoice()]);
    universityChoicesApi.updateUniversityChoice.mockResolvedValue(makeChoice({ status: "SHORTLISTED" }));

    renderWithProviders(<StudentUniversityChoicesContent studentId="student-1" />);
    await screen.findAllByText(/Computer Science/);

    await userEvent.selectOptions(screen.getByLabelText("Trạng thái lựa chọn"), "SHORTLISTED");

    await waitFor(() => expect(universityChoicesApi.updateUniversityChoice).toHaveBeenCalledWith("choice-1", { status: "SHORTLISTED" }));
  });
});
