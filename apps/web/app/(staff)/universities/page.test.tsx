import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { University } from "@/lib/universities/types";
import UniversitiesPage from "./page";

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

beforeEach(() => {
  vi.resetAllMocks();
});

function makeUniversity(overrides: Partial<University> = {}): University {
  return {
    id: "uni-1",
    universityCode: "UNI-2026-00001",
    officialName: "University of Testing",
    countryCode: "US",
    city: "Boston",
    campus: null,
    website: null,
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

describe("UniversitiesPage (list)", () => {
  it("shows the forbidden state for a role without admission_master:view (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(<UniversitiesPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(universitiesApi.listUniversities).not.toHaveBeenCalled();
  });

  it("renders the university list for a role with view access (SALES_MARKETING, catalog browsing only)", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    universitiesApi.listUniversities.mockResolvedValue({ data: [makeUniversity()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<UniversitiesPage />);

    expect(await screen.findByText("UNI-2026-00001")).toBeInTheDocument();
    expect(screen.getByText(/University of Testing/)).toBeInTheDocument();
    // SALES_MARKETING has admission_master:view only, never create.
    expect(screen.queryByRole("button", { name: "+ Tạo trường" })).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no universities", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    universitiesApi.listUniversities.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });

    renderWithProviders(<UniversitiesPage />);

    expect(await screen.findByText("Không có trường đại học nào.")).toBeInTheDocument();
  });

  it("creates a university and surfaces a 409 DUPLICATE_UNIVERSITY conflict verbatim, never a frontend duplicate check", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    universitiesApi.listUniversities.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    universitiesApi.createUniversity.mockRejectedValue(
      new ApiError(409, { error: { code: "DUPLICATE_UNIVERSITY", message: "A university named \"Dup U\" already exists for country US (UNI-2026-00002).", requestId: "r1", existingUniversityId: "uni-existing" } }),
    );

    renderWithProviders(<UniversitiesPage />);
    await screen.findByText("Không có trường đại học nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo trường" }));
    await userEvent.type(screen.getByLabelText("Tên chính thức *"), "Dup U");
    await userEvent.type(screen.getByLabelText("Mã quốc gia (ISO-2) *"), "US");
    await userEvent.click(screen.getByRole("button", { name: "Tạo trường" }));

    expect(await screen.findByText(/đã tồn tại/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem trường đại học đã tồn tại →" })).toHaveAttribute("href", "/universities/uni-existing");
  });

  it("creates a university and calls createUniversity with the entered fields", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    universitiesApi.listUniversities.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    universitiesApi.createUniversity.mockResolvedValue(makeUniversity());

    renderWithProviders(<UniversitiesPage />);
    await screen.findByText("Không có trường đại học nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo trường" }));
    await userEvent.type(screen.getByLabelText("Tên chính thức *"), "New Uni");
    await userEvent.type(screen.getByLabelText("Mã quốc gia (ISO-2) *"), "gb");
    await userEvent.click(screen.getByRole("button", { name: "Tạo trường" }));

    await waitFor(() =>
      expect(universitiesApi.createUniversity).toHaveBeenCalledWith(expect.objectContaining({ officialName: "New Uni", countryCode: "GB" })),
    );
  });
});
