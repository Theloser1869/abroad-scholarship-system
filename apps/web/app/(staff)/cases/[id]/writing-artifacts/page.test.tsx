import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import { CaseWritingArtifactsContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));

const casesApi = vi.hoisted(() => ({ getCase: vi.fn() }));
vi.mock("@/lib/cases/api", () => casesApi);

const writingApi = vi.hoisted(() => ({
  listWritingArtifactsForCase: vi.fn(),
  createWritingArtifact: vi.fn(),
}));
vi.mock("@/lib/writing/api", () => writingApi);

const lorApi = vi.hoisted(() => ({
  listLorForCase: vi.fn(),
  createLor: vi.fn(),
  updateLor: vi.fn(),
}));
vi.mock("@/lib/lor/api", () => lorApi);

beforeEach(() => {
  vi.resetAllMocks();
  casesApi.getCase.mockResolvedValue({ id: "case-1", caseCode: "C-0001" });
});

function renderPage(caseId = "case-1") {
  return renderWithProviders(
    <RequirePermission resource="writing" action="view">
      <CaseWritingArtifactsContent caseId={caseId} />
    </RequirePermission>,
  );
}

describe("CaseWritingArtifactsPage", () => {
  it("shows the forbidden state for a role without writing:view", async () => {
    authState.principal = { userId: "u1", roleCode: "ADMIN_FINANCE" };
    renderPage();
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
  });

  it("renders the artifact list and the LOR tracking card side by side", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.listWritingArtifactsForCase.mockResolvedValue([
      { id: "artifact-1", caseId: "case-1", type: "Personal Essay", title: "Common App Essay", status: "DRAFT", ownerId: "u1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", versions: [] },
    ]);
    lorApi.listLorForCase.mockResolvedValue([
      {
        id: "lor-1",
        caseId: "case-1",
        recommenderName: "Ms. Nguyen",
        relationship: "Homeroom teacher",
        contactEmail: "teacher@example.com",
        contactPhone: null,
        requestDate: null,
        deadline: "2026-03-01T00:00:00.000Z",
        requestStatus: "REQUESTED",
        submissionStatus: "PENDING",
        internalNotes: null,
        evidenceDocumentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Common App Essay")).toBeInTheDocument();
    expect(screen.getByText("Ms. Nguyen")).toBeInTheDocument();
    expect(screen.getByText("Đã yêu cầu")).toBeInTheDocument();
    expect(screen.getByText("Chưa nộp")).toBeInTheDocument();
  });

  it("redacts contactEmail/contactPhone to null for STUDENT_PARENT (FieldPolicyService.redactLor) without crashing", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    writingApi.listWritingArtifactsForCase.mockResolvedValue([]);
    lorApi.listLorForCase.mockResolvedValue([
      {
        id: "lor-1",
        caseId: "case-1",
        recommenderName: "Ms. Nguyen",
        relationship: null,
        contactEmail: null,
        contactPhone: null,
        requestDate: null,
        deadline: null,
        requestStatus: "NOT_REQUESTED",
        submissionStatus: "PENDING",
        internalNotes: null,
        evidenceDocumentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    renderPage();

    expect(await screen.findByText("Ms. Nguyen")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "+ Thêm LOR" })).not.toBeInTheDocument();
  });

  it("creates a writing artifact via the dialog", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    writingApi.listWritingArtifactsForCase.mockResolvedValue([]);
    lorApi.listLorForCase.mockResolvedValue([]);
    writingApi.createWritingArtifact.mockResolvedValue({ id: "artifact-1" });

    renderPage();
    await screen.findByText("Chưa có bài viết nào cho case này.");

    await userEvent.click(screen.getByRole("button", { name: "+ Tạo bài viết" }));
    await userEvent.type(screen.getByLabelText("Loại *"), "SOP");
    await userEvent.type(screen.getByLabelText("Tiêu đề *"), "Statement of Purpose");
    await userEvent.click(screen.getByRole("button", { name: "Tạo" }));

    await waitFor(() => expect(writingApi.createWritingArtifact).toHaveBeenCalledWith("case-1", expect.objectContaining({ type: "SOP", title: "Statement of Purpose" })));
  });
});
