-- CreateEnum
CREATE TYPE "PartnerDocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PartnerLinkStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('CONTRACT_VALUE', 'PAYMENT_COLLECTED', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionTransactionStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'CALCULATED', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "partner_documents" DROP COLUMN "file_reference",
ADD COLUMN     "document_id" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "status" "PartnerDocumentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "partner_programs" ADD COLUMN     "program_id" TEXT;

-- AlterTable
ALTER TABLE "partners" ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "internal_notes" TEXT;

-- CreateTable
CREATE TABLE "partner_student_links" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "case_id" TEXT,
    "application_id" TEXT,
    "link_type" TEXT NOT NULL,
    "status" "PartnerLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_student_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rules" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "partner_program_id" TEXT,
    "basis" "CommissionBasis" NOT NULL,
    "percentage_rate" DECIMAL(7,4),
    "fixed_amount" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL,
    "conditions" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "effective_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_transactions" (
    "id" TEXT NOT NULL,
    "partner_id" TEXT NOT NULL,
    "commission_rule_id" TEXT,
    "student_id" TEXT,
    "case_id" TEXT,
    "application_id" TEXT,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "basis" "CommissionBasis",
    "basis_amount" DECIMAL(14,2),
    "rate" DECIMAL(7,4),
    "calculated_amount" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL,
    "status" "CommissionTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "payment_reference" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_student_links_partner_id_idx" ON "partner_student_links"("partner_id");

-- CreateIndex
CREATE INDEX "partner_student_links_student_id_idx" ON "partner_student_links"("student_id");

-- CreateIndex
CREATE INDEX "partner_student_links_case_id_idx" ON "partner_student_links"("case_id");

-- CreateIndex
CREATE INDEX "commission_rules_partner_id_partner_program_id_status_idx" ON "commission_rules"("partner_id", "partner_program_id", "status");

-- CreateIndex
CREATE INDEX "commission_transactions_partner_id_idx" ON "commission_transactions"("partner_id");

-- CreateIndex
CREATE INDEX "commission_transactions_status_idx" ON "commission_transactions"("status");

-- CreateIndex
CREATE INDEX "commission_transactions_source_type_source_id_idx" ON "commission_transactions"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_documents_partner_id_type_version_key" ON "partner_documents"("partner_id", "type", "version");

-- CreateIndex
CREATE INDEX "partner_programs_program_id_idx" ON "partner_programs"("program_id");

-- AddForeignKey
ALTER TABLE "partner_programs" ADD CONSTRAINT "partner_programs_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_documents" ADD CONSTRAINT "partner_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_student_links" ADD CONSTRAINT "partner_student_links_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_partner_program_id_fkey" FOREIGN KEY ("partner_program_id") REFERENCES "partner_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_commission_rule_id_fkey" FOREIGN KEY ("commission_rule_id") REFERENCES "commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_transactions" ADD CONSTRAINT "commission_transactions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

