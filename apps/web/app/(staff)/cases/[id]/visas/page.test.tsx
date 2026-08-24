import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { Visa } from "@/lib/visas/types";
import { CaseVisasContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const visasApi = vi.hoisted(() => ({ listVisasForCase: vi.fn(), createVisa: vi.fn() }));
vi.mock("@/lib/visas/api", () => visasApi);
const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "CASE-2026-00001" });
});

function makeVisa(overrides: Partial<Visa> = {}): Visa {
  return {
    id: "visa-1",
    visaCode: "VISA-2026-00001",
    studentId: "student-1",
    caseId: "case-1",
    offerId: null,
    countryCode: "US",
    visaType: "Student",
    status: "PREPARING",
    submittedAt: null,
    submissionReference: null,
    evidenceDocumentId: null,
    appointmentAt: null,
    appointmentLocation: null,
    appointmentReference: null,
    interviewAt: null,
    interviewNotes: null,
    resultDate: null,
    resultEvidenceDocumentId: null,
    reason: null,
    internalNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseVisasContent (case-scoped only — no global /visas list exists)", () => {
  it("shows the forbidden state for a role without visa:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderWithProviders(
      <RequirePermission resource="visa" action="view">
        <CaseVisasContent caseId="case-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(visasApi.listVisasForCase).not.toHaveBeenCalled();
  });

  it("renders the case's visa list", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    visasApi.listVisasForCase.mockResolvedValue({ data: [makeVisa()], meta: { page: 1, limit: 20, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<CaseVisasContent caseId="case-1" />);

    expect(await screen.findByText("VISA-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
  });

  it("creates a visa via the dialog, surfacing 409 ACTIVE_VISA_EXISTS verbatim on a repeat attempt", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    visasApi.listVisasForCase.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    visasApi.createVisa.mockResolvedValue(makeVisa());

    renderWithProviders(<CaseVisasContent caseId="case-1" />);
    await screen.findByText("Chưa có hồ sơ visa nào.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo hồ sơ visa" }));
    await userEvent.type(screen.getByLabelText("Mã quốc gia (ISO-2) *"), "us");
    await userEvent.type(screen.getByLabelText("Loại visa *"), "Student");
    await userEvent.click(screen.getByRole("button", { name: "Tạo hồ sơ" }));

    await waitFor(() => expect(visasApi.createVisa).toHaveBeenCalledWith("case-1", expect.objectContaining({ countryCode: "US", visaType: "Student" })));
  });
});
