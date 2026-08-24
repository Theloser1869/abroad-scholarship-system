import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { University } from "@/lib/universities/types";
import { UniversityDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const universitiesApi = vi.hoisted(() => ({
  listUniversities: vi.fn(),
  getUniversity: vi.fn(),
  createUniversity: vi.fn(),
  updateUniversity: vi.fn(),
  verifyUniversity: vi.fn(),
}));
vi.mock("@/lib/universities/api", () => universitiesApi);

const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn(), getProgram: vi.fn(), createProgram: vi.fn(), updateProgram: vi.fn(), verifyProgram: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);

const scholarshipMastersApi = vi.hoisted(() => ({
  listScholarshipMasters: vi.fn(),
  getScholarshipMaster: vi.fn(),
  createScholarshipMaster: vi.fn(),
  updateScholarshipMaster: vi.fn(),
  verifyScholarshipMaster: vi.fn(),
}));
vi.mock("@/lib/scholarship-masters/api", () => scholarshipMastersApi);

beforeEach(() => {
  vi.resetAllMocks();
  programsApi.listPrograms.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });
  scholarshipMastersApi.listScholarshipMasters.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } });
});

function makeUniversity(overrides: Partial<University> = {}): University {
  return {
    id: "uni-1",
    universityCode: "UNI-2026-00001",
    officialName: "University of Testing",
    countryCode: "US",
    city: "Boston",
    campus: null,
    website: "https://example.edu",
    admissionsUrl: null,
    status: "ACTIVE",
    ownerId: null,
    source: null,
    sourceUrl: null,
    externalId: null,
    retrievedAt: null,
    syncStatus: "NOT_SYNCED",
    lastVerifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("UniversityDetailContent", () => {
  it("renders detail fields and hides Sửa/Xác minh for a view-only role", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    universitiesApi.getUniversity.mockResolvedValue(makeUniversity());

    renderWithProviders(<UniversityDetailContent id="uni-1" />);

    expect(await screen.findByText("University of Testing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Xác minh/ })).not.toBeInTheDocument();
  });

  it("verify stamps lastVerifiedAt via the dedicated action, for a role with admission_master:verify", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    universitiesApi.getUniversity.mockResolvedValue(makeUniversity({ lastVerifiedAt: null }));
    universitiesApi.verifyUniversity.mockResolvedValue(makeUniversity({ lastVerifiedAt: "2026-01-03T00:00:00.000Z" }));

    renderWithProviders(<UniversityDetailContent id="uni-1" />);
    await screen.findByText("University of Testing");

    await userEvent.click(screen.getByRole("button", { name: "Xác minh" }));

    await waitFor(() => expect(universitiesApi.verifyUniversity).toHaveBeenCalled());
  });

  it("CONSULTANT (view-only master data) cannot verify (403) — hidden entirely", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    universitiesApi.getUniversity.mockResolvedValue(makeUniversity());

    renderWithProviders(<UniversityDetailContent id="uni-1" />);
    await screen.findByText("University of Testing");

    expect(screen.queryByRole("button", { name: /Xác minh/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
  });
});
