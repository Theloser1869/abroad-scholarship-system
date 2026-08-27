-- AlterTable (Client Acceptance Remediation DEC-09, 2026-08-27 — GAP-006/REQ-PARTNER-008
-- Visa leg: additive-only, no existing data touched)
ALTER TABLE "commission_transactions" ADD COLUMN     "visa_id" TEXT;

-- CreateIndex
CREATE INDEX "commission_transactions_visa_id_idx" ON "commission_transactions"("visa_id");

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_visa_id_fkey" FOREIGN KEY ("visa_id") REFERENCES "visas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
