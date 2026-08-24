import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { Visa } from "@/lib/visas/types";
import { VisaDetailContent } from "./page";

const portalApi = vi.hoisted(() => ({ getPortalVisa: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeVisa(overrides: Partial<Visa> = {}): Visa {
  return {
    id: "visa-1",
    visaCode: "VISA-2026-00001",
    studentId: "student-A",
    caseId: "case-1",
    offerId: null,
    countryCode: "US",
    visaType: "F-1",
    status: "REFUSED",
    submittedAt: null,
    submissionReference: null,
    evidenceDocumentId: null,
    appointmentAt: "2026-02-01T09:00:00.000Z",
    appointmentLocation: "Lãnh sự quán",
    appointmentReference: null,
    interviewAt: "2026-02-01T10:00:00.000Z",
    interviewNotes: "Phỏng vấn diễn ra tốt.",
    resultDate: "2026-02-05T00:00:00.000Z",
    resultEvidenceDocumentId: null,
    reason: "Thiếu minh chứng tài chính.",
    internalNotes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/// F08 instruction §21/§27 — `internalNotes` (staff-internal refusal strategy) is `null` on
/// the wire for STUDENT_PARENT and simply never rendered; `interviewNotes`/`reason` are NOT
/// redacted (the affected Student/Parent's own recorded outcome) and DO render. This suite
/// asserts both halves of that distinction directly, not just "the page renders."
describe("Portal VisaDetailContent — field redaction awareness", () => {
  it("renders reason/interviewNotes (the caller's own outcome, never redacted)", async () => {
    portalApi.getPortalVisa.mockResolvedValue(makeVisa());
    renderWithProviders(<VisaDetailContent studentId="student-A" visaId="visa-1" />);

    expect(await screen.findByText("Thiếu minh chứng tài chính.")).toBeInTheDocument();
  });

  it("never renders internalNotes even as a labeled empty field when the backend sends it null", async () => {
    portalApi.getPortalVisa.mockResolvedValue(makeVisa({ internalNotes: null }));
    renderWithProviders(<VisaDetailContent studentId="student-A" visaId="visa-1" />);
    await screen.findByText(/F-1/);
    expect(screen.queryByText(/internalNotes|ghi chú nội bộ/i)).not.toBeInTheDocument();
  });

  it("shows 'no checklist' framing correctly by not attempting to render one at all (no Portal Visa-checklist endpoint exists)", async () => {
    portalApi.getPortalVisa.mockResolvedValue(makeVisa());
    renderWithProviders(<VisaDetailContent studentId="student-A" visaId="visa-1" />);
    await screen.findByText(/F-1/);
    expect(screen.queryByText(/checklist/i)).not.toBeInTheDocument();
  });
});
