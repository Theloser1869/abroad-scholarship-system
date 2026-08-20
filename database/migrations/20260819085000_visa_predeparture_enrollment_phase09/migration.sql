-- CreateEnum
CREATE TYPE "VisaStatus" AS ENUM ('NOT_STARTED', 'PREPARING', 'READY', 'SUBMITTED', 'APPOINTMENT', 'INTERVIEW', 'GRANTED', 'REFUSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "TaskTemplateTrigger" ADD VALUE 'VISA_GRANTED';

-- CreateTable
CREATE TABLE "visas" (
    "id" TEXT NOT NULL,
    "visa_code" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "offer_id" TEXT,
    "country_code" CHAR(2) NOT NULL,
    "visa_type" TEXT NOT NULL,
    "status" "VisaStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "submitted_at" TIMESTAMP(3),
    "submission_reference" TEXT,
    "evidence_document_id" TEXT,
    "appointment_at" TIMESTAMP(3),
    "appointment_location" TEXT,
    "appointment_reference" TEXT,
    "interview_at" TIMESTAMP(3),
    "interview_notes" TEXT,
    "result_date" TIMESTAMP(3),
    "result_evidence_document_id" TEXT,
    "reason" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_checklist_templates" (
    "id" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "visa_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_checklist_items" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
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

    CONSTRAINT "visa_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "university_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "confirmation_date" TIMESTAMP(3),
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PLANNED',
    "evidence_document_id" TEXT,
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visas_visa_code_key" ON "visas"("visa_code");

-- CreateIndex
CREATE INDEX "visas_student_id_idx" ON "visas"("student_id");

-- CreateIndex
CREATE INDEX "visas_case_id_idx" ON "visas"("case_id");

-- CreateIndex
CREATE INDEX "visas_offer_id_idx" ON "visas"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "visa_checklist_templates_country_code_visa_type_title_key" ON "visa_checklist_templates"("country_code", "visa_type", "title");

-- CreateIndex
CREATE INDEX "visa_checklist_items_entity_type_entity_id_idx" ON "visa_checklist_items"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");

-- CreateIndex
CREATE INDEX "enrollments_case_id_idx" ON "enrollments"("case_id");

-- CreateIndex
CREATE INDEX "enrollments_offer_id_idx" ON "enrollments"("offer_id");

-- AddForeignKey
ALTER TABLE "visas" ADD CONSTRAINT "visas_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas" ADD CONSTRAINT "visas_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas" ADD CONSTRAINT "visas_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas" ADD CONSTRAINT "visas_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visas" ADD CONSTRAINT "visas_result_evidence_document_id_fkey" FOREIGN KEY ("result_evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_checklist_items" ADD CONSTRAINT "visa_checklist_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

