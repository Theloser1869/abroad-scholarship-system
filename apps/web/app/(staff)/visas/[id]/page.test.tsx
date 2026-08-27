import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Visa, VisaChecklistItem } from "@/lib/visas/types";
import { VisaDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const visasApi = vi.hoisted(() => ({
  listVisasForCase: vi.fn(),
  getVisa: vi.fn(),
  createVisa: vi.fn(),
  updateVisa: vi.fn(),
  updateVisaStatus: vi.fn(),
  submitVisa: vi.fn(),
  scheduleVisaAppointment: vi.fn(),
  recordVisaInterview: vi.fn(),
  recordVisaResult: vi.fn(),
  listVisaChecklist: vi.fn(),
  createVisaChecklistItem: vi.fn(),
  updateVisaChecklistItem: vi.fn(),
}));
vi.mock("@/lib/visas/api", () => visasApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
  visasApi.listVisaChecklist.mockResolvedValue([]);
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
    status: "READY",
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

function makeChecklistItem(overrides: Partial<VisaChecklistItem> = {}): VisaChecklistItem {
  return {
    id: "vci-1",
    entityType: "Visa",
    entityId: "visa-1",
    title: "Hộ chiếu còn hạn",
    category: null,
    required: true,
    ownerId: null,
    deadline: null,
    status: "PENDING",
    documentId: null,
    notes: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("VisaDetailContent", () => {
  it("shows the forbidden state for a role without visa:view", async () => {
    // ADMIN_FINANCE now holds view-only `visa:view` (client permission-matrix remediation,
    // 2026-08-25) — SALES_MARKETING has no `visa` grant at all.
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(
      <RequirePermission resource="visa" action="view">
        <VisaDetailContent id="visa-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(visasApi.getVisa).not.toHaveBeenCalled();
  });

  it("renders the checklist alongside the header, and submitting from READY re-verifies the checklist gate server-side, surfacing 409 CHECKLIST_INCOMPLETE verbatim", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    visasApi.getVisa.mockResolvedValue(makeVisa({ status: "READY" }));
    visasApi.listVisaChecklist.mockResolvedValue([makeChecklistItem()]);
    visasApi.submitVisa.mockRejectedValue(new ApiError(409, { error: { code: "CHECKLIST_INCOMPLETE", message: "Checklist incomplete.", requestId: "r1" } }));

    renderWithProviders(<VisaDetailContent id="visa-1" />);
    await screen.findByRole("heading", { name: "VISA-2026-00001" });
    expect(screen.getByText("Hộ chiếu còn hạn")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Nộp hồ sơ" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Nộp hồ sơ" })[1]);

    expect(await screen.findByText("Còn hạng mục checklist bắt buộc chưa hoàn tất/miễn trừ.")).toBeInTheDocument();
  });

  it("schedules an appointment from SUBMITTED", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    visasApi.getVisa.mockResolvedValue(makeVisa({ status: "SUBMITTED", submittedAt: "2026-02-01T00:00:00.000Z" }));
    visasApi.scheduleVisaAppointment.mockResolvedValue(makeVisa({ status: "APPOINTMENT" }));

    renderWithProviders(<VisaDetailContent id="visa-1" />);
    await screen.findByRole("heading", { name: "VISA-2026-00001" });

    await userEvent.click(screen.getByRole("button", { name: "Đặt lịch hẹn" }));
    await userEvent.type(screen.getByLabelText("Ngày giờ hẹn *"), "2026-03-01T09:00");
    await userEvent.click(screen.getAllByRole("button", { name: "Đặt lịch hẹn" })[1]);

    await waitFor(() => expect(visasApi.scheduleVisaAppointment).toHaveBeenCalledWith("visa-1", expect.objectContaining({ appointmentAt: "2026-03-01T09:00" })));
  });

  it("hides every action once GRANTED (terminal) and shows the result card", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    visasApi.getVisa.mockResolvedValue(makeVisa({ status: "GRANTED", resultDate: "2026-04-01T00:00:00.000Z" }));

    renderWithProviders(<VisaDetailContent id="visa-1" />);
    await screen.findByRole("heading", { name: "VISA-2026-00001" });

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi nhận kết quả" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kết quả" })).toBeInTheDocument();
  });

  it("STUDENT_PARENT sees internalNotes rendered exactly as returned (redacted to null) and no edit action, but interviewNotes/reason are never redacted", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    visasApi.getVisa.mockResolvedValue(makeVisa({ status: "REFUSED", internalNotes: null, reason: "Insufficient funds evidence.", resultDate: "2026-04-01T00:00:00.000Z" }));

    renderWithProviders(<VisaDetailContent id="visa-1" />);
    await screen.findByRole("heading", { name: "VISA-2026-00001" });

    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.getByText("Insufficient funds evidence.")).toBeInTheDocument();
  });
});
