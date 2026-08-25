import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { Partner } from "@/lib/partners/types";
import type { PartnerProgram } from "@/lib/partner-programs/types";
import type { PartnerDocument } from "@/lib/partner-documents/types";
import type { PartnerStudentLink } from "@/lib/partner-student-links/types";
import type { CommissionTransaction } from "@/lib/commission-transactions/types";
import { PartnerDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const partnersApi = vi.hoisted(() => ({ getPartner: vi.fn(), updatePartner: vi.fn(), archivePartner: vi.fn() }));
vi.mock("@/lib/partners/api", () => partnersApi);
const partnerProgramsApi = vi.hoisted(() => ({ listPartnerPrograms: vi.fn(), createPartnerProgram: vi.fn(), updatePartnerProgram: vi.fn() }));
vi.mock("@/lib/partner-programs/api", () => partnerProgramsApi);
const partnerDocumentsApi = vi.hoisted(() => ({
  listPartnerDocuments: vi.fn(),
  createPartnerDocument: vi.fn(),
  updatePartnerDocument: vi.fn(),
  activatePartnerDocument: vi.fn(),
  archivePartnerDocument: vi.fn(),
}));
vi.mock("@/lib/partner-documents/api", () => partnerDocumentsApi);
const partnerStudentLinksApi = vi.hoisted(() => ({
  listPartnerStudentLinksForPartner: vi.fn(),
  createPartnerStudentLink: vi.fn(),
  updatePartnerStudentLink: vi.fn(),
  archivePartnerStudentLink: vi.fn(),
}));
vi.mock("@/lib/partner-student-links/api", () => partnerStudentLinksApi);
const commissionTransactionsApi = vi.hoisted(() => ({ listCommissionTransactionsForPartner: vi.fn(), createCommissionTransaction: vi.fn() }));
vi.mock("@/lib/commission-transactions/api", () => commissionTransactionsApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);
const programsApi = vi.hoisted(() => ({ listPrograms: vi.fn() }));
vi.mock("@/lib/programs/api", () => programsApi);
const studentsApi = vi.hoisted(() => ({ listStudents: vi.fn() }));
vi.mock("@/lib/students/api", () => studentsApi);

function emptyPage<T>(): { data: T[]; meta: { page: number; limit: number; totalItems: number; totalPages: number } } {
  return { data: [], meta: { page: 1, limit: 50, totalItems: 0, totalPages: 0 } };
}

beforeEach(() => {
  vi.resetAllMocks();
  partnerProgramsApi.listPartnerPrograms.mockResolvedValue(emptyPage());
  partnerDocumentsApi.listPartnerDocuments.mockResolvedValue(emptyPage());
  partnerStudentLinksApi.listPartnerStudentLinksForPartner.mockResolvedValue(emptyPage());
  commissionTransactionsApi.listCommissionTransactionsForPartner.mockResolvedValue(emptyPage());
  programsApi.listPrograms.mockResolvedValue(emptyPage());
  studentsApi.listStudents.mockResolvedValue(emptyPage());
});

function makePartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-1",
    partnerCode: "PTN-2026-00001",
    name: "Global Education Agency",
    type: "AGENCY",
    countryCode: "VN",
    contactName: "Nguyen Van A",
    contactEmail: "contact@agency.example",
    contactPhone: null,
    website: null,
    ownerId: null,
    internalNotes: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function makeProgram(overrides: Partial<PartnerProgram> = {}): PartnerProgram {
  return {
    id: "pp-1",
    partnerProgramCode: "PP-2026-00001",
    partnerId: "partner-1",
    partner: { id: "partner-1", name: "Global Education Agency", countryCode: "VN" },
    programId: null,
    program: null,
    name: "Foundation Pathway",
    degreeLevel: "Foundation",
    major: null,
    intake: null,
    tuition: null,
    tuitionCurrency: null,
    scholarshipInfo: null,
    admissionsRule: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeDocument(overrides: Partial<PartnerDocument> = {}): PartnerDocument {
  return {
    id: "pd-1",
    partnerId: "partner-1",
    type: "MOU",
    version: 1,
    status: "DRAFT",
    effectiveDate: null,
    expiryDate: null,
    documentId: "doc-1",
    ownerId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLink(overrides: Partial<PartnerStudentLink> = {}): PartnerStudentLink {
  return {
    id: "psl-1",
    partnerId: "partner-1",
    partner: { id: "partner-1", name: "Global Education Agency", countryCode: "VN" },
    studentId: "student-1",
    student: { id: "student-1", studentCode: "STU-2026-00001", fullName: "Tran Thi B" },
    caseId: null,
    applicationId: null,
    contractId: null,
    scholarshipApplicationId: null,
    linkType: "Referral",
    status: "ACTIVE",
    effectiveDate: null,
    endDate: null,
    notes: null,
    createdById: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<CommissionTransaction> = {}): CommissionTransaction {
  return {
    id: "ct-1",
    partnerId: "partner-1",
    partner: { id: "partner-1", name: "Global Education Agency", countryCode: "VN" },
    commissionRuleId: null,
    studentId: "student-1",
    student: { id: "student-1", studentCode: "STU-2026-00001", fullName: "Tran Thi B" },
    caseId: null,
    applicationId: null,
    contractId: null,
    sourceType: "Payment",
    sourceId: "payment-12345678",
    basis: null,
    basisAmount: null,
    rate: null,
    calculatedAmount: null,
    currency: "USD",
    status: "PENDING",
    paidAt: null,
    paymentReference: null,
    reason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PartnerDetailContent — PartnerProgram/PartnerDocument/PartnerStudentLink render as sections with Dialogs (no standalone route); Commission Rules links out to its own route", () => {
  it("shows the forbidden state for a role without partner:view", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    renderWithProviders(
      <RequirePermission resource="partner" action="view">
        <PartnerDetailContent id="partner-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(partnersApi.getPartner).not.toHaveBeenCalled();
  });

  it("renders every sub-section for a role with full visibility (ADMIN_FINANCE)", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    partnersApi.getPartner.mockResolvedValue(makePartner());
    partnerProgramsApi.listPartnerPrograms.mockResolvedValue({ data: [makeProgram()], meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 } });
    partnerDocumentsApi.listPartnerDocuments.mockResolvedValue({ data: [makeDocument()], meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 } });
    partnerStudentLinksApi.listPartnerStudentLinksForPartner.mockResolvedValue({ data: [makeLink()], meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 } });
    commissionTransactionsApi.listCommissionTransactionsForPartner.mockResolvedValue({ data: [makeTransaction()], meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 } });

    renderWithProviders(<PartnerDetailContent id="partner-1" />);

    await screen.findByRole("heading", { name: "Global Education Agency" });
    expect(screen.getByText("Foundation Pathway")).toBeInTheDocument();
    expect(screen.getByText("Tran Thi B")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem quy tắc hoa hồng →" })).toHaveAttribute("href", "/partners/partner-1/commission-rules");
  });

  it("creates a PartnerProgram from the Partner detail page's own dialog (no standalone route)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    partnersApi.getPartner.mockResolvedValue(makePartner());
    partnerProgramsApi.createPartnerProgram.mockResolvedValue(makeProgram());

    renderWithProviders(<PartnerDetailContent id="partner-1" />);
    await screen.findByRole("heading", { name: "Global Education Agency" });

    await userEvent.click(screen.getByRole("button", { name: "+ Chương trình" }));
    await userEvent.type(screen.getByLabelText("Tên chương trình *"), "New Pathway");
    await userEvent.click(screen.getByRole("button", { name: "Tạo" }));

    await waitFor(() => expect(partnerProgramsApi.createPartnerProgram).toHaveBeenCalledWith("partner-1", expect.objectContaining({ name: "New Pathway" })));
  });

  it("STUDENT_PARENT has no visibility into any partner sub-section (no matching resource grants at all)", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    partnersApi.getPartner.mockResolvedValue(makePartner());

    renderWithProviders(
      <RequirePermission resource="partner" action="view">
        <PartnerDetailContent id="partner-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
  });
});
