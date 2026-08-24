import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import { RequirePermission } from "@/components/shell/require-permission";
import type { DocumentRecord } from "@/lib/documents/types";
import { DocumentDetailContent } from "./page";

const authState = vi.hoisted(() => ({ principal: null as { userId: string; roleCode: string } | null }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => authState }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const documentsApi = vi.hoisted(() => ({
  getDocument: vi.fn(),
  requestDocumentDownload: vi.fn(),
  updateDocument: vi.fn(),
  shareDocument: vi.fn(),
  archiveDocument: vi.fn(),
  createDocumentVersion: vi.fn(),
}));
vi.mock("@/lib/documents/api", () => documentsApi);

const usersApi = vi.hoisted(() => ({ listUsers: vi.fn() }));
vi.mock("@/lib/users/api", () => usersApi);

beforeEach(() => {
  vi.resetAllMocks();
  usersApi.listUsers.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, totalItems: 0, totalPages: 0 } });
});

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    documentCode: "DOC-2026-00001",
    ownerEntity: "Case",
    ownerId: "case-1",
    documentType: "PASSPORT",
    title: "Hộ chiếu Nguyễn Văn A",
    version: 1,
    fileReference: "storage-key-1",
    originalFilename: "passport.pdf",
    mimeType: "application/pdf",
    sizeBytes: "1048576",
    checksumSha256: "abcdef0123456789abcdef0123456789",
    status: "DRAFT",
    scanStatus: "CLEAN",
    uploadedById: "user-1",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    retentionUntil: null,
    legalHold: false,
    archivedAt: null,
    previousVersionId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DocumentDetailContent — reached only by a known id, no bare list route", () => {
  it("shows the forbidden state for a role without documents:view", async () => {
    authState.principal = { userId: "u1", roleCode: "SYSTEM_ADMIN" };
    renderWithProviders(
      <RequirePermission resource="documents" action="view">
        <DocumentDetailContent id="doc-1" />
      </RequirePermission>,
    );
    expect(await screen.findByText(/Không có quyền truy cập/)).toBeInTheDocument();
    expect(documentsApi.getDocument).not.toHaveBeenCalled();
  });

  it("renders full metadata, and the download action is available when CLEAN", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument());

    renderWithProviders(<DocumentDetailContent id="doc-1" />);

    expect(await screen.findByText("DOC-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("Hộ chiếu Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("passport.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem tài liệu" })).toBeInTheDocument();
  });

  it("disables download and shows a pending banner while scanStatus is PENDING", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument({ scanStatus: "PENDING" }));

    renderWithProviders(<DocumentDetailContent id="doc-1" />);

    expect(await screen.findByText(/đang được quét virus/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xem tài liệu" })).not.toBeInTheDocument();
  });

  it("blocks download and shows a danger banner when INFECTED", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument({ scanStatus: "INFECTED" }));

    renderWithProviders(<DocumentDetailContent id="doc-1" />);

    // The scan-status badge and the danger banner both contain "Nhiễm mã độc" text — assert
    // on the banner specifically (role=alert) to avoid the ambiguous multi-match.
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nhiễm mã độc/);
    expect(screen.queryByRole("button", { name: "Xem tài liệu" })).not.toBeInTheDocument();
  });

  it("lets an editor update title/documentType via the edit dialog", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument());
    documentsApi.updateDocument.mockResolvedValue(makeDocument({ title: "Hộ chiếu (đã cập nhật)" }));
    const user = userEvent.setup();

    renderWithProviders(<DocumentDetailContent id="doc-1" />);
    await screen.findByText("DOC-2026-00001");

    await user.click(screen.getByRole("button", { name: "Sửa" }));
    const titleInputs = screen.getAllByDisplayValue("Hộ chiếu Nguyễn Văn A");
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], "Hộ chiếu (đã cập nhật)");
    await user.click(screen.getAllByRole("button", { name: "Lưu" })[0]);

    await waitFor(() => expect(documentsApi.updateDocument).toHaveBeenCalledWith("doc-1", { title: "Hộ chiếu (đã cập nhật)", documentType: "PASSPORT" }));
  });

  it("hides Sửa/Lưu trữ once ARCHIVED (Share stays available — the backend's own `share` action has no archived check), and the previous-version link walks backward only", async () => {
    authState.principal = { userId: "u1", roleCode: "CONSULTANT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument({ status: "ARCHIVED", archivedAt: "2026-02-01T00:00:00.000Z", previousVersionId: "doc-0" }));

    renderWithProviders(<DocumentDetailContent id="doc-1" />);

    await screen.findByText("DOC-2026-00001");
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chia sẻ" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem phiên bản trước" })).toHaveAttribute("href", "/documents/doc-0");
  });

  it("STUDENT_PARENT sees the document (view+download grant) but no edit/share/archive actions", async () => {
    authState.principal = { userId: "u1", roleCode: "STUDENT_PARENT" };
    documentsApi.getDocument.mockResolvedValue(makeDocument());

    renderWithProviders(<DocumentDetailContent id="doc-1" />);

    await screen.findByText("DOC-2026-00001");
    expect(screen.getByRole("button", { name: "Xem tài liệu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chia sẻ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
  });
});
