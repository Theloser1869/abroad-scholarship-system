import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { Roadmap } from "@/lib/roadmaps/types";
import { RoadmapDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const roadmapsApi = vi.hoisted(() => ({
  getRoadmap: vi.fn(),
  submitRoadmap: vi.fn(),
  approveRoadmap: vi.fn(),
  rejectRoadmap: vi.fn(),
  updateRoadmapStatus: vi.fn(),
  createMilestone: vi.fn(),
  updateMilestone: vi.fn(),
  updateMilestoneStatus: vi.fn(),
  addMilestoneDependency: vi.fn(),
  removeMilestoneDependency: vi.fn(),
}));
vi.mock("@/lib/roadmaps/api", () => roadmapsApi);

const usersApi = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock("@/lib/users/api", () => usersApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeRoadmap(overrides: Partial<Roadmap> = {}): Roadmap {
  return {
    id: "roadmap-1",
    caseId: "case-1",
    assessmentId: "assessment-1",
    version: 1,
    horizonYears: 2,
    status: "DRAFT",
    approvedById: null,
    approvedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    milestones: [
      {
        id: "milestone-1",
        roadmapId: "roadmap-1",
        stage: "Năm 11",
        objective: "Hoàn thành IELTS 7.0",
        metric: "IELTS band score",
        target: "7.0",
        ownerRole: null,
        ownerId: null,
        startAt: null,
        deadline: "2026-06-01T00:00:00.000Z",
        status: "IN_PROGRESS",
        evidenceDocumentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderDetail(id = "roadmap-1") {
  return renderWithProviders(
    <RequirePermission resource="roadmaps" action="view">
      <RoadmapDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("RoadmapDetailPage", () => {
  it("renders roadmap version/status and its milestones", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    roadmapsApi.getRoadmap.mockResolvedValue(makeRoadmap());

    renderDetail();

    expect(await screen.findByText(/Phiên bản 1 \(2 năm\)/)).toBeInTheDocument();
    // Also appears as an <option> in the always-mounted MilestoneDependencyDialog.
    expect(screen.getAllByText("Hoàn thành IELTS 7.0").length).toBeGreaterThan(0);
  });

  it("hides Duyệt/Từ chối for CONSULTANT (roadmaps:approve is ED/DM-only) while REVIEW", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    roadmapsApi.getRoadmap.mockResolvedValue(makeRoadmap({ status: "REVIEW" }));

    renderDetail();
    await screen.findByText(/Phiên bản 1/);

    expect(screen.queryByRole("button", { name: "Duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
  });

  it("approves the roadmap via the dedicated endpoint (never a bare status PATCH)", async () => {
    authState.principal = { userId: "u1", roleCode: "EXECUTIVE_DIRECTOR" };
    roadmapsApi.getRoadmap.mockResolvedValue(makeRoadmap({ status: "REVIEW" }));
    roadmapsApi.approveRoadmap.mockResolvedValue(makeRoadmap({ status: "APPROVED" }));

    renderDetail();
    await screen.findByText(/Phiên bản 1/);

    await userEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(roadmapsApi.approveRoadmap).toHaveBeenCalledWith("roadmap-1", undefined));
  });

  it("surfaces PREREQUISITE_NOT_DONE with the exact unmet IDs when marking a milestone DONE too early", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    roadmapsApi.getRoadmap.mockResolvedValue(makeRoadmap());
    roadmapsApi.updateMilestoneStatus.mockRejectedValue(
      new ApiError(409, {
        error: { code: "PREREQUISITE_NOT_DONE", message: "prerequisite", requestId: "r1", unmetTaskIds: ["task-9"] },
      }),
    );

    renderDetail();
    await screen.findAllByText("Hoàn thành IELTS 7.0");

    await userEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái mốc mới"), "DONE");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByText(/task-9/)).toBeInTheDocument();
  });
});
