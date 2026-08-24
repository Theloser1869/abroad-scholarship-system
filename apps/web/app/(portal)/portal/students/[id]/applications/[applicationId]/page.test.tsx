import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { PortalApplicationDetail } from "@/lib/portal/types";
import { ApplicationDetailContent } from "./page";

const portalApi = vi.hoisted(() => ({ getPortalApplication: vi.fn(), submitChecklistEvidence: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);
const documentsApi = vi.hoisted(() => ({ uploadDocument: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeApplication(overrides: Partial<PortalApplicationDetail> = {}): PortalApplicationDetail {
  return {
    id: "app-1",
    applicationCode: "APP-2026-00001",
    studentId: "student-A",
    caseId: "case-1",
    programId: "program-1",
    program: { id: "program-1", degreeLevel: "Cử nhân", major: "Khoa học máy tính", university: { id: "u1", officialName: "Đại học ABC", countryCode: "US" } },
    intendedIntake: null,
    deadline: "2026-06-01T00:00:00.000Z",
    status: "PREPARING",
    submittedAt: null,
    submissionChannel: null,
    submissionReference: null,
    evidenceDocumentId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    checklist: [
      { id: "chk-1", applicationId: "app-1", title: "Bảng điểm", required: true, ownerId: null, deadline: null, status: "PENDING", documentId: null, notes: null, completedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    ],
    currentOffer: null,
    ...overrides,
  };
}

/// F08 instruction §19 — read-only except the one narrow checklist-evidence action; no
/// submit()/status-mutation/offer-response is ever exposed here.
describe("Portal ApplicationDetailContent", () => {
  it("renders the university/program and checklist, with no submit/status action anywhere", async () => {
    portalApi.getPortalApplication.mockResolvedValue(makeApplication());
    renderWithProviders(<ApplicationDetailContent studentId="student-A" applicationId="app-1" />);

    expect(await screen.findByText("Đại học ABC")).toBeInTheDocument();
    expect(screen.getByText("Bảng điểm", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nộp hồ sơ|Submit/ })).not.toBeInTheDocument();
  });

  it("renders the current offer when present", async () => {
    portalApi.getPortalApplication.mockResolvedValue(
      makeApplication({ currentOffer: { id: "offer-1", applicationId: "app-1", offerType: "Unconditional", offerDate: null, acceptanceDeadline: "2026-07-01T00:00:00.000Z", depositAmount: null, depositCurrency: null, isConditional: false, conditions: null, status: "RECEIVED", respondedAt: null, evidenceDocumentId: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } }),
    );
    renderWithProviders(<ApplicationDetailContent studentId="student-A" applicationId="app-1" />);
    expect(await screen.findByText("Unconditional")).toBeInTheDocument();
  });

  it("uploads evidence then submits its documentId against the exact checklist item", async () => {
    portalApi.getPortalApplication.mockResolvedValue(makeApplication());
    documentsApi.uploadDocument.mockResolvedValue({ id: "doc-new", duplicateOfId: null });
    portalApi.submitChecklistEvidence.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<ApplicationDetailContent studentId="student-A" applicationId="app-1" />);
    await user.click(await screen.findByRole("button", { name: "Gửi minh chứng" }));

    const file = new File(["%PDF-1.4"], "transcript.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getAllByRole("button", { name: "Gửi minh chứng" })[1]);

    await waitFor(() => expect(portalApi.submitChecklistEvidence).toHaveBeenCalledWith("student-A", "chk-1", "doc-new"));
  });
});
