-- CreateEnum
CREATE TYPE "UniversityChoiceTier" AS ENUM ('REACH', 'MATCH', 'SAFETY');

-- CreateEnum
CREATE TYPE "UniversityChoiceStatus" AS ENUM ('PROPOSED', 'SHORTLISTED', 'CONFIRMED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'WAIVED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('RECEIVED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ScholarshipApplicationStatus" AS ENUM ('PLANNING', 'SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'AWARDED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskTemplateTrigger" ADD VALUE 'APPLICATION_SUBMITTED';
ALTER TYPE "TaskTemplateTrigger" ADD VALUE 'SCHOLARSHIP_AWARDED';

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_case_id_fkey";

-- DropIndex
DROP INDEX "applications_student_id_program_id_key";

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "evidence_document_id" TEXT,
ADD COLUMN     "intended_intake" TEXT,
ADD COLUMN     "submission_channel" TEXT,
ADD COLUMN     "submission_reference" TEXT,
ALTER COLUMN "case_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "scholarship_masters" ADD COLUMN     "percentage" DECIMAL(5,2),
ADD COLUMN     "source" TEXT,
ADD COLUMN     "university_id" TEXT;

-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "campus" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "university_choices" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "case_id" TEXT,
    "program_id" TEXT NOT NULL,
    "tier" "UniversityChoiceTier" NOT NULL,
    "rationale" TEXT,
    "status" "UniversityChoiceStatus" NOT NULL DEFAULT 'PROPOSED',
    "owner_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "university_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_checklist_items" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "owner_id" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "document_id" TEXT,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "offer_type" TEXT NOT NULL,
    "offer_date" TIMESTAMP(3),
    "acceptance_deadline" TIMESTAMP(3),
    "deposit_amount" DECIMAL(14,2),
    "deposit_currency" CHAR(3),
    "is_conditional" BOOLEAN NOT NULL DEFAULT false,
    "conditions" TEXT,
    "status" "OfferStatus" NOT NULL DEFAULT 'RECEIVED',
    "responded_at" TIMESTAMP(3),
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarship_applications" (
    "id" TEXT NOT NULL,
    "scholarship_application_code" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "case_id" TEXT,
    "scholarship_master_id" TEXT NOT NULL,
    "application_id" TEXT,
    "status" "ScholarshipApplicationStatus" NOT NULL DEFAULT 'PLANNING',
    "eligibility_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "eligibility_notes" TEXT,
    "deadline" TIMESTAMP(3),
    "essay_artifact_id" TEXT,
    "interview_at" TIMESTAMP(3),
    "internal_notes" TEXT,
    "conditions" TEXT,
    "award_amount" DECIMAL(14,2),
    "award_currency" CHAR(3),
    "award_coverage_type" TEXT,
    "award_period" TEXT,
    "award_acceptance_deadline" TIMESTAMP(3),
    "evidence_document_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarship_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "university_choices_case_id_idx" ON "university_choices"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "university_choices_student_id_program_id_key" ON "university_choices"("student_id", "program_id");

-- CreateIndex
CREATE INDEX "application_checklist_items_application_id_idx" ON "application_checklist_items"("application_id");

-- CreateIndex
CREATE INDEX "offers_application_id_idx" ON "offers"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_applications_scholarship_application_code_key" ON "scholarship_applications"("scholarship_application_code");

-- CreateIndex
CREATE INDEX "scholarship_applications_student_id_idx" ON "scholarship_applications"("student_id");

-- CreateIndex
CREATE INDEX "scholarship_applications_case_id_idx" ON "scholarship_applications"("case_id");

-- CreateIndex
CREATE INDEX "scholarship_applications_scholarship_master_id_idx" ON "scholarship_applications"("scholarship_master_id");

-- CreateIndex
CREATE INDEX "scholarship_applications_application_id_idx" ON "scholarship_applications"("application_id");

-- CreateIndex
CREATE INDEX "applications_student_id_program_id_idx" ON "applications"("student_id", "program_id");

-- CreateIndex
CREATE INDEX "applications_case_id_idx" ON "applications"("case_id");

-- CreateIndex
CREATE INDEX "scholarship_masters_university_id_idx" ON "scholarship_masters"("university_id");

-- AddForeignKey
ALTER TABLE "scholarship_masters" ADD CONSTRAINT "scholarship_masters_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_choices" ADD CONSTRAINT "university_choices_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_choices" ADD CONSTRAINT "university_choices_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "university_choices" ADD CONSTRAINT "university_choices_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklist_items" ADD CONSTRAINT "application_checklist_items_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklist_items" ADD CONSTRAINT "application_checklist_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_scholarship_master_id_fkey" FOREIGN KEY ("scholarship_master_id") REFERENCES "scholarship_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_essay_artifact_id_fkey" FOREIGN KEY ("essay_artifact_id") REFERENCES "writing_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

