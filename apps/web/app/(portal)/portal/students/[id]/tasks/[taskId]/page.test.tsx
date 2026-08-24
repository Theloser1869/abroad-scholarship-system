import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { ApiError } from "@/lib/api/types";
import type { PortalTask } from "@/lib/portal/types";
import { TaskDetailContent } from "./page";

const portalApi = vi.hoisted(() => ({ getPortalTask: vi.fn(), submitPortalTaskOutput: vi.fn(), updatePortalTaskStatus: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeTask(overrides: Partial<PortalTask> = {}): PortalTask {
  return {
    id: "task-1",
    taskCode: "TASK-2026-00001",
    caseId: "case-1",
    module: "ADMISSION",
    taskType: "DOCUMENT_COLLECTION",
    title: "Nộp bảng điểm",
    ownerId: null,
    priority: "HIGH",
    startAt: null,
    deadline: "2026-03-01T00:00:00.000Z",
    status: "NOT_STARTED",
    output: null,
    qualityScore: null,
    blocker: null,
    templateId: null,
    sourceEntityType: null,
    sourceEntityId: null,
    milestoneId: null,
    visibleToStudent: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    isOverdue: false,
    ...overrides,
  };
}

/// F08 instruction §15/§16 — `ownerId`/`blocker`/`qualityScore` are ALWAYS null on the wire
/// for a Portal Task (unconditional server-side redaction); this suite confirms the page
/// simply never renders them (nothing to hide client-side — there is no field to accidentally
/// leak), and that only the two portal-allowed status targets are ever offered.
describe("Portal TaskDetailContent", () => {
  it("never renders any staff-only field (ownerId/blocker/qualityScore) even when null-shaped fields are present on the wire", async () => {
    portalApi.getPortalTask.mockResolvedValue(makeTask());
    renderWithProviders(<TaskDetailContent studentId="student-A" taskId="task-1" />);
    expect(await screen.findByText("Nộp bảng điểm")).toBeInTheDocument();
    expect(screen.queryByText(/blocker/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/qualityScore|quality score|điểm chất lượng/i)).not.toBeInTheDocument();
  });

  it("offers 'Bắt đầu thực hiện' (→ IN_PROGRESS) from NOT_STARTED, never a direct 'Hoàn thành' jump", async () => {
    portalApi.getPortalTask.mockResolvedValue(makeTask({ status: "NOT_STARTED" }));
    renderWithProviders(<TaskDetailContent studentId="student-A" taskId="task-1" />);
    await screen.findByText("Nộp bảng điểm");
    expect(screen.getByRole("button", { name: "Bắt đầu thực hiện" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đánh dấu hoàn thành" })).not.toBeInTheDocument();
  });

  it("requests IN_PROGRESS via the portal-allowed status endpoint, surfacing a real 409 verbatim if the FSM rejects it", async () => {
    portalApi.getPortalTask.mockResolvedValue(makeTask({ status: "NOT_STARTED" }));
    portalApi.updatePortalTaskStatus.mockRejectedValue(
      new ApiError(409, { error: { code: "INVALID_TASK_STATUS_TRANSITION", message: "bad", requestId: "r1" } }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TaskDetailContent studentId="student-A" taskId="task-1" />);
    await user.click(await screen.findByRole("button", { name: "Bắt đầu thực hiện" }));

    await waitFor(() => expect(portalApi.updatePortalTaskStatus).toHaveBeenCalledWith("student-A", "task-1", "IN_PROGRESS"));
  });

  it("lets the student submit their own output text (the one field they may write directly)", async () => {
    portalApi.getPortalTask.mockResolvedValue(makeTask({ status: "IN_PROGRESS" }));
    portalApi.submitPortalTaskOutput.mockResolvedValue(makeTask({ status: "IN_PROGRESS", output: "Đã nộp bảng điểm gốc." }));
    const user = userEvent.setup();
    renderWithProviders(<TaskDetailContent studentId="student-A" taskId="task-1" />);

    await user.click(await screen.findByRole("button", { name: "+ Nhập kết quả" }));
    await user.type(screen.getByRole("textbox"), "Đã nộp bảng điểm gốc.");
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(portalApi.submitPortalTaskOutput).toHaveBeenCalledWith("student-A", "task-1", "Đã nộp bảng điểm gốc."));
  });
});
