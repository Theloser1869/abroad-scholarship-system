import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { ApiError } from "@/lib/api/types";
import type { WritingArtifact } from "@/lib/writing/types";
import { WritingArtifactDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const writingApi = vi.hoisted(() => ({
  getWritingArtifact: vi.fn(),
  updateWritingStatus: vi.fn(),
  createWritingVersion: vi.fn(),
  reviewWritingVersion: vi.fn(),
  listWritingVersionComments: vi.fn(),
  addWritingVersionComment: vi.fn(),
}));
vi.mock("@/lib/writing/api", () => writingApi);

beforeEach(() => {
  vi.resetAllMocks();
  writingApi.listWritingVersionComments.mockResolvedValue([]);
});

function makeArtifact(overrides: Partial<WritingArtifact> = {}): WritingArtifact {
  return {
    id: "artifact-1",
    caseId: "case-1",
    type: "Personal Essay",
    title: "Common App Essay",
    status: "DRAFT",
    ownerId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    versions: [
      {
        id: "version-1",
        artifactId: "artifact-1",
        versionNumber: 1,
        createdById: "u1",
        changeSummary: "Bản đầu tiên",
        content: "Draft content...",
        documentId: null,
        reviewStatus: "PENDING",
        reviewerId: null,
        reviewedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderDetail(id = "artifact-1") {
  return renderWithProviders(
    <RequirePermission resource="writing" action="view">
      <WritingArtifactDetailContent id={id} />
    </RequirePermission>,
  );
}

describe("WritingArtifactDetailPage", () => {
  it("renders artifact header/status and its version history", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.getWritingArtifact.mockResolvedValue(makeArtifact());

    renderDetail();

    expect(await screen.findByText("Common App Essay")).toBeInTheDocument();
    expect(screen.getByText("Phiên bản 1")).toBeInTheDocument();
    expect(screen.getByText("Draft content...")).toBeInTheDocument();
  });

  it("shows the exact 404-non-enumeration copy for an out-of-scope/nonexistent artifact", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.getWritingArtifact.mockRejectedValue(new ApiError(404, { error: { code: "WRITING_ARTIFACT_NOT_FOUND", message: "nf", requestId: "r1" } }));

    renderDetail();

    expect(await screen.findByText("Không tìm thấy hoặc bạn không có quyền truy cập.")).toBeInTheDocument();
  });

  it("hides Duyệt phiên bản/Yêu cầu chỉnh sửa/status actions for STUDENT_PARENT (writing:view only)", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    writingApi.getWritingArtifact.mockResolvedValue(makeArtifact());

    renderDetail();
    await screen.findByText("Common App Essay");

    expect(screen.queryByRole("button", { name: "Duyệt phiên bản" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yêu cầu chỉnh sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Phiên bản mới" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
  });

  it("creates a new version (never edits an existing one) and reviews it via the dedicated endpoint", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.getWritingArtifact.mockResolvedValue(makeArtifact());
    writingApi.reviewWritingVersion.mockResolvedValue({ reviewed: true });

    renderDetail();
    await screen.findByText("Common App Essay");

    await userEvent.click(screen.getByRole("button", { name: "Duyệt phiên bản" }));

    await waitFor(() => expect(writingApi.reviewWritingVersion).toHaveBeenCalledWith("version-1", "APPROVED"));
  });

  it("transitions status through the dedicated FSM endpoint, never a bare field edit", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.getWritingArtifact.mockResolvedValue(makeArtifact());
    writingApi.updateWritingStatus.mockResolvedValue(makeArtifact({ status: "REVIEW" }));

    renderDetail();
    await screen.findByText("Common App Essay");

    await userEvent.click(screen.getByRole("button", { name: "Chuyển trạng thái" }));
    await userEvent.selectOptions(screen.getByLabelText("Trạng thái mới"), "REVIEW");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    await waitFor(() => expect(writingApi.updateWritingStatus).toHaveBeenCalledWith("artifact-1", "REVIEW"));
  });

  it("hides version/status actions once the artifact is SUBMITTED (terminal state)", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.getWritingArtifact.mockResolvedValue(makeArtifact({ status: "SUBMITTED" }));

    renderDetail();
    await screen.findByText("Common App Essay");

    expect(screen.queryByRole("button", { name: "+ Phiên bản mới" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chuyển trạng thái" })).not.toBeInTheDocument();
  });
});
