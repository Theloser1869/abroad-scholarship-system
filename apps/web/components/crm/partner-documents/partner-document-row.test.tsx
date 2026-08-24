import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/lib/test-utils/render-with-providers";
import type { PartnerDocument } from "@/lib/partner-documents/types";
import { PartnerDocumentRow } from "./partner-document-row";

const partnerDocumentsApi = vi.hoisted(() => ({
  updatePartnerDocument: vi.fn(),
  activatePartnerDocument: vi.fn(),
  archivePartnerDocument: vi.fn(),
}));
vi.mock("@/lib/partner-documents/api", () => partnerDocumentsApi);
const documentsApi = vi.hoisted(() => ({ getDocument: vi.fn(), requestDocumentDownload: vi.fn() }));
vi.mock("@/lib/documents/api", () => documentsApi);

beforeEach(() => {
  vi.resetAllMocks();
});

function makeDocument(overrides: Partial<PartnerDocument> = {}): PartnerDocument {
  return {
    id: "pd-1",
    partnerId: "partner-1",
    type: "MOU",
    version: 1,
    status: "DRAFT",
    effectiveDate: null,
    expiryDate: null,
    documentId: "doc-1",
    ownerId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("PartnerDocumentRow — editable only while DRAFT (409 PARTNER_DOCUMENT_NOT_EDITABLE once ACTIVE), a signed version is a new row, never an in-place edit", () => {
  it("offers Sửa/Kích hoạt while DRAFT", async () => {
    renderWithProviders(
      <ul>
        <PartnerDocumentRow document={makeDocument({ status: "DRAFT" })} canEdit={true} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Sửa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kích hoạt" })).toBeInTheDocument();
  });

  it("hides Sửa/Kích hoạt once ACTIVE — editing is locked, correction requires a new version row", async () => {
    renderWithProviders(
      <ul>
        <PartnerDocumentRow document={makeDocument({ status: "ACTIVE" })} canEdit={true} />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu trữ" })).toBeInTheDocument();
  });

  it("activates a DRAFT document after confirmation via the shared ConfirmDialog (F09 — no more window.confirm), superseding the prior ACTIVE row server-side (never computed client-side)", async () => {
    partnerDocumentsApi.activatePartnerDocument.mockResolvedValue(makeDocument({ status: "ACTIVE" }));

    renderWithProviders(
      <ul>
        <PartnerDocumentRow document={makeDocument({ status: "DRAFT" })} canEdit={true} />
      </ul>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Kích hoạt" }));
    expect(partnerDocumentsApi.activatePartnerDocument).not.toHaveBeenCalled();
    // Trigger button + the dialog's own confirm button share the label — the dialog's is second.
    await userEvent.click(screen.getAllByRole("button", { name: "Kích hoạt" })[1]);

    await waitFor(() => expect(partnerDocumentsApi.activatePartnerDocument).toHaveBeenCalledWith("pd-1"));
  });

  it("hides every mutating action for a read-only viewer (canEdit=false) — only the document-view action remains", async () => {
    renderWithProviders(
      <ul>
        <PartnerDocumentRow document={makeDocument({ status: "DRAFT" })} canEdit={false} />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kích hoạt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu trữ" })).not.toBeInTheDocument();
  });
});
