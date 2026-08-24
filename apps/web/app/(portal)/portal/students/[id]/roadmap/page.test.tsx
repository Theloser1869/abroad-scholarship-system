import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { PortalRoadmap } from "@/lib/portal/types";
import { RoadmapContent } from "./page";

const portalApi = vi.hoisted(() => ({ getPortalRoadmap: vi.fn(), submitMilestoneEvidence: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);
const documentsApi = vi.hoisted(() => ({ uploadDocument: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeRoadmap(overrides: Partial<PortalRoadmap> = {}): PortalRoadmap {
  return {
    id: "roadmap-1",
    caseId: "case-1",
    assessmentId: null,
    version: 1,
    horizonYears: 4,
    status: "ACTIVE",
    approvedById: null,
    approvedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    progress: 50,
    milestones: [
      {
        id: "m1",
        roadmapId: "roadmap-1",
        stage: "Chuẩn bị hồ sơ",
        objective: "Hoàn thành bài luận",
        metric: null,
        target: null,
        ownerRole: null,
        ownerId: null,
        startAt: null,
        deadline: "2026-03-01T00:00:00.000Z",
        status: "IN_PROGRESS",
        evidenceDocumentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

/// F08 instruction §13/§14: read-only overview + the one narrow evidence-submit mutation —
/// no "mark milestone complete" action exists anywhere in this UI.
describe("Portal RoadmapContent", () => {
  it("shows an empty state when the student's Case has no roadmap yet", async () => {
    portalApi.getPortalRoadmap.mockResolvedValue(null);
    renderWithProviders(<RoadmapContent studentId="student-A" />);
    expect(await screen.findByText("Chưa có lộ trình.")).toBeInTheDocument();
  });

  it("renders progress and milestones, and never offers a 'complete' action — only 'submit evidence'", async () => {
    portalApi.getPortalRoadmap.mockResolvedValue(makeRoadmap());
    renderWithProviders(<RoadmapContent studentId="student-A" />);

    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Hoàn thành bài luận")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gửi minh chứng" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hoàn thành$/ })).not.toBeInTheDocument();
  });

  it("uploads a file then submits its documentId as milestone evidence (two real backend steps, never one invented combined call)", async () => {
    portalApi.getPortalRoadmap.mockResolvedValue(makeRoadmap());
    documentsApi.uploadDocument.mockResolvedValue({ id: "doc-new", duplicateOfId: null });
    portalApi.submitMilestoneEvidence.mockResolvedValue({});
    const user = userEvent.setup();

    renderWithProviders(<RoadmapContent studentId="student-A" />);
    await user.click(await screen.findByRole("button", { name: "Gửi minh chứng" }));

    const file = new File(["%PDF-1.4"], "essay.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    // Two "Gửi minh chứng" buttons now exist (the trigger + the dialog's own submit) — the
    // dialog's is the second in DOM order.
    await user.click(screen.getAllByRole("button", { name: "Gửi minh chứng" })[1]);

    await waitFor(() =>
      expect(documentsApi.uploadDocument).toHaveBeenCalledWith(
        { ownerEntity: "Student", ownerId: "student-A", documentType: "MILESTONE_EVIDENCE", title: expect.stringContaining("Hoàn thành bài luận") },
        file,
      ),
    );
    await waitFor(() => expect(portalApi.submitMilestoneEvidence).toHaveBeenCalledWith("student-A", "m1", "doc-new"));
  });
});
