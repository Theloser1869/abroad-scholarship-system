import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { Program } from "@/lib/programs/types";
import ProgramsPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn(), getProgram: vi.fn(), createProgram: vi.fn(), updateProgram: vi.fn(), verifyProgram: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);
const universitiesApi = vi.hoisted(() => ({ listUniversities: vi.fn() }));
vi.mock("@/lib/universities/api", () => universitiesApi);

beforeEach(() => {
  vi.resetAllMocks();
  universitiesApi.listUniversities.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: "prog-1",
    programCode: "PRG-2026-00001",
    universityId: "uni-1",
    university: { id: "uni-1", officialName: "University of Testing", countryCode: "US" },
    degreeLevel: "Bachelor",
    major: "Computer Science",
    intake: "Fall 2027",
    durationMonths: 48,
    tuition: "30000.00",
    tuitionCurrency: "USD",
    applicationFee: "75.00",
    eligibility: null,
    requirements: null,
    source: null,
    sourceUrl: null,
    externalId: null,
    retrievedAt: null,
    syncStatus: "NOT_SYNCED",
    status: "ACTIVE",
    lastVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProgramsPage (list)", () => {
  it("renders the university name via the DEC-11 embed, never a bare universityId", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    programsApi.listPrograms.mockResolvedValue({ data: [makeProgram()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<ProgramsPage />);

    expect(await screen.findByText("PRG-2026-00001")).toBeInTheDocument();
    expect(screen.getByText(/University of Testing/)).toBeInTheDocument();
    expect(screen.getByText(/Computer Science/)).toBeInTheDocument();
  });

  it("shows a 409 DUPLICATE_PROGRAM conflict verbatim on create", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    programsApi.listPrograms.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    universitiesApi.listUniversities.mockResolvedValue({
      data: [{ id: "uni-1", officialName: "University of Testing", countryCode: "US" }],
      meta: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
    });
    programsApi.createProgram.mockRejectedValue(
      new ApiError(409, { error: { code: "DUPLICATE_PROGRAM", message: "A program already exists.", requestId: "r1", existingProgramId: "prog-existing" } }),
    );

    renderWithProviders(<ProgramsPage />);
    await screen.findByText("Không có chương trình nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo chương trình" }));
    await userEvent.type(screen.getByPlaceholderText("Tìm theo tên trường..."), "Testing");
    await userEvent.click(await screen.findByRole("button", { name: /University of Testing/ }));
    await userEvent.type(screen.getByLabelText("Bậc học *"), "Master");
    await userEvent.type(screen.getByLabelText("Ngành *"), "Data Science");
    await userEvent.click(screen.getByRole("button", { name: "Tạo chương trình" }));

    expect(await screen.findByText(/đã tồn tại/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem chương trình đã tồn tại →" })).toHaveAttribute("href", "/programs/prog-existing");
  });

  it("SALES_MARKETING (catalog browsing only) cannot create a program", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    programsApi.listPrograms.mockResolvedValue({ data: [makeProgram()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<ProgramsPage />);
    await screen.findByText("PRG-2026-00001");

    expect(screen.queryByRole("button", { name: "+ Tạo chương trình" })).not.toBeInTheDocument();
  });
});
