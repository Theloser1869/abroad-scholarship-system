-- Phase 14 fix (Final Architect Review) — `DocumentsService.listAccessibleTo` filters by
-- `principal_id` alone; the only prior index on this table led with `document_id`
-- (@@unique([documentId, principalId, permission])), giving that query no index support.
-- Purely additive.

CREATE INDEX "document_access_principal_id_permission_idx" ON "document_access"("principal_id", "permission");
