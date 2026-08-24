import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { UploadDocumentResult } from "@/lib/documents/types";
import DocumentUploadPage from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const documentsApi = vi.hoisted(() => ({ uploadDocument: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DocumentUploadPage — the generic entry point (no per-entity upload button exists on every F03-F06 page)", () => {
  it("shows the forbidden state for a role without documents:create (SALES_MARKETING has no `documents` grant at all)", async () => {
    authState.principal = { userId: "u1", roleCode: "SALES_MARKETING" };
    renderWithProviders(<DocumentUploadPage />);
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(documentsApi.uploadDocument).not.toHaveBeenCalled();
  });

  it("uploads and navigates to the new document's detail page, surfacing a non-blocking duplicate note when present", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    const result: UploadDocumentResult = {
      id: "doc-new",
      documentCode: "DOC-2026-00099",
      ownerEntity: "Case",
      ownerId: "case-1",
      documentType: "PASSPORT",
      title: "Hộ chiếu",
      version: 1,
      fileReference: "key",
      originalFilename: "passport.pdf",
      mimeType: "application/pdf",
      sizeBytes: "1024",
      checksumSha256: "abc",
      status: "DRAFT",
      scanStatus: "PENDING",
      uploadedById: "u1",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      retentionUntil: null,
      legalHold: false,
      archivedAt: null,
      previousVersionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      duplicateOfId: "doc-old",
    };
    documentsApi.uploadDocument.mockResolvedValue(result);
    const user = userEvent.setup();

    renderWithProviders(<DocumentUploadPage />);

    await user.type(screen.getByLabelText("Ngữ cảnh (loại đối tượng sở hữu)"), "Case");
    await user.type(screen.getByLabelText("ID đối tượng sở hữu"), "case-1");
    await user.type(screen.getByLabelText("Loại tài liệu"), "PASSPORT");
    await user.type(screen.getByLabelText("Tiêu đề"), "Hộ chiếu");

    const file = new File(["%PDF-1.4"], "passport.pdf", { type: "application/pdf" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(screen.getByRole("button", { name: "Tải lên" }));

    await waitFor(() =>
      expect(documentsApi.uploadDocument).toHaveBeenCalledWith(
        { ownerEntity: "Case", ownerId: "case-1", documentType: "PASSPORT", title: "Hộ chiếu" },
        file,
      ),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/documents/doc-new"));
  });
});
