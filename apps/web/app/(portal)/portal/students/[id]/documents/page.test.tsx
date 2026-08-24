import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { DocumentRecord } from "@/lib/documents/types";
import { DocumentsContent } from "./page";

const portalApi = vi.hoisted(() => ({ listPortalDocuments: vi.fn(), requestPortalDocumentDownload: vi.fn() }));
vi.mock("@/lib/portal/api", () => portalApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    documentCode: "DOC-2026-00001",
    ownerEntity: "Student",
    ownerId: "student-A",
    documentType: "TRANSCRIPT",
    title: "Bảng điểm",
    version: 1,
    fileReference: "key",
    originalFilename: "transcript.pdf",
    mimeType: "application/pdf",
    sizeBytes: "2048",
    checksumSha256: null,
    status: "SUBMITTED",
    scanStatus: "CLEAN",
    uploadedById: "student-A",
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

/// F08 instruction §17/§18 — exactly the caller's own grants (no bare list/scan by owner),
/// download only ever offered once `scanStatus === 'CLEAN'`, same rule F07 established.
describe("Portal DocumentsContent", () => {
  it("shows an empty state when the caller holds no document grants", async () => {
    portalApi.listPortalDocuments.mockResolvedValue([]);
    renderWithProviders(<DocumentsContent studentId="student-A" />);
    expect(await screen.findByText("Chưa có tài liệu nào.")).toBeInTheDocument();
  });

  it("offers Tải xuống only for a CLEAN document", async () => {
    portalApi.listPortalDocuments.mockResolvedValue([makeDocument({ id: "doc-clean", scanStatus: "CLEAN" }), makeDocument({ id: "doc-pending", scanStatus: "PENDING", title: "Hộ chiếu" })]);
    renderWithProviders(<DocumentsContent studentId="student-A" />);

    await screen.findByText("Bảng điểm");
    expect(screen.getAllByRole("button", { name: "Tải xuống" })).toHaveLength(1);
  });
});
