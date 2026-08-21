/// F04 only integrates document *links* — it does not rebuild the Document subsystem
/// (frontend_prompts F04 §31: "Không xây lại Document subsystem"). No document list/upload UI
/// exists yet in this app (that's F07 scope, docs/frontend/FRONTEND_ROUTES.md); a Profile
/// Evidence/Writing form here can only reference an already-uploaded document by ID (manual
/// UUID entry, same documented-limitation pattern as F03's `UserPicker` fallback), and a
/// detail page resolves that ID to a real signed-download link via the existing 2-step flow.

export interface DocumentSummary {
  id: string;
  documentCode: string;
  title: string;
  originalFilename: string | null;
  mimeType: string | null;
  scanStatus: string;
}
