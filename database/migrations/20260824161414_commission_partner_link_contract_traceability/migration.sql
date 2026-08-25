-- AlterTable
ALTER TABLE "commission_transactions" ADD COLUMN     "contract_id" TEXT;

-- AlterTable
ALTER TABLE "partner_student_links" ADD COLUMN     "contract_id" TEXT,
ADD COLUMN     "scholarship_application_id" TEXT;

-- CreateIndex
CREATE INDEX "commission_transactions_contract_id_idx" ON "commission_transactions"("contract_id");

-- CreateIndex
CREATE INDEX "partner_student_links_contract_id_idx" ON "partner_student_links"("contract_id");

-- CreateIndex
CREATE INDEX "partner_student_links_scholarship_application_id_idx" ON "partner_student_links"("scholarship_application_id");

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_scholarship_application_id_fkey" FOREIGN KEY ("scholarship_application_id") REFERENCES "scholarship_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
