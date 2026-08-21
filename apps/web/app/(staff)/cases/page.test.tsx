import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import CasesPage from "./page";
import type { Case } from "@/lib/cases/types";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState,
}));

const casesApi = vi.hoisted(() => ({
  listCases: vi.fn(),
  getCase: vi.fn(),
  updateCaseStage: vi.fn(),
  updateCaseStatus: vi.fn(),
  closeCase: vi.fn(),
  listCaseMembers: vi.fn(),
  addCaseMember: vi.fn(),
  removeCaseMember: vi.fn(),
  reassignCaseOwner: vi.fn(),
  addCaseNote: vi.fn(),
  getCaseTimeline: vi.fn(),
}));
vi.mock("@/lib/cases/api", () => casesApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "case-1",
    caseCode: "C-0001",
    studentId: "student-1",
    student: { id: "student-1", studentCode: "HS-0001", fullName: "Phạm Văn C" },
    contractId: null,
    ownerId: "owner-1",
    owner: { id: "owner-1", username: "consultant1", fullName: "Nguyễn Tư Vấn" },
    department: "Tư vấn",
    stage: "DISCOVERY",
    status: "OPEN",
    closureReason: null,
    openedAt: "2026-01-01T00:00:00.000Z",
    closedAt: null,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CasesPage — list", () => {
  it("shows the forbidden state for a role without cases:view", () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(<CasesPage />);

    expect(screen.getByText("Không có quyền truy cập.")).toBeInTheDocument();
    expect(casesApi.listCases).not.toHaveBeenCalled();
  });

  it("renders case rows with student/owner names (never a bare studentId/ownerId — DEC-09)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.listCases.mockResolvedValue({
      data: [makeCase()],
      meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    renderWithProviders(<CasesPage />);

    expect(await screen.findByText("C-0001")).toBeInTheDocument();
    expect(screen.getByText("Phạm Văn C")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Tư Vấn")).toBeInTheDocument();
  });

  it("shows the empty state when there are zero cases in scope", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    casesApi.listCases.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    renderWithProviders(<CasesPage />);

    expect(await screen.findByText("Không có case nào.")).toBeInTheDocument();
  });
});
