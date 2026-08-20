/// Phase 12 (12-platform/02_INTEGRATIONS_JOBS.md "adapters: e-signature"). No Phase 01-12
/// instruction file names a concrete e-signature workflow beyond `Contract.sign()`'s
/// existing internal FSM action (Phase 05, staff-recorded `signedDocumentId` — see
/// `docs/ASSUMPTIONS.md` ASM-15). Building this interface's real call site would mean
/// inventing a business workflow no MD asks for. The interface + default stub exist so a
/// future phase adding a concrete e-signature-vendor flow has the adapter boundary ready;
/// see `docs/ASSUMPTIONS.md` ASM-54. `POST /webhooks/esign` (this phase) receives and
/// records inbound events from a real provider without assuming this interface is wired to
/// anything yet.
export const ESIGN_PROVIDER = Symbol('ESIGN_PROVIDER');

export interface ESignEnvelopeRequest {
  documentId: string;
  signerEmail: string;
}

export interface ESignEnvelopeResult {
  envelopeId: string;
}

export interface ESignProvider {
  createEnvelope(request: ESignEnvelopeRequest): Promise<ESignEnvelopeResult>;
}
