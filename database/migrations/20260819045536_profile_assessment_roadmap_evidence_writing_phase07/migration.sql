-- CreateEnum
CREATE TYPE "WritingStatus" AS ENUM ('DRAFT', 'REVIEW', 'REVISION', 'FINAL', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "WritingReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "LorRequestStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'IN_PROGRESS', 'RECEIVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LorSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'NOT_REQUIRED');

-- AlterEnum
ALTER TYPE "AssessmentStatus" ADD VALUE 'REVIEW';

-- AlterEnum
ALTER TYPE "TaskTemplateTrigger" ADD VALUE 'ROADMAP_APPROVED';

-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "change_reason" TEXT;

-- AlterTable
ALTER TABLE "roadmap_milestones" ADD COLUMN     "evidence_document_id" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "target" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "milestone_id" TEXT;

-- CreateTable
CREATE TABLE "assessment_criteria" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "current_score" DECIMAL(6,2),
    "target_score" DECIMAL(6,2),
    "gap" DECIMAL(6,2),
    "priority" TEXT,
    "recommendation" TEXT,
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_milestone_dependencies" (
    "milestone_id" TEXT NOT NULL,
    "depends_on_milestone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmap_milestone_dependencies_pkey" PRIMARY KEY ("milestone_id","depends_on_milestone_id")
);

-- CreateTable
CREATE TABLE "academic_records" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "gpa" DECIMAL(5,2),
    "grading_scale" TEXT,
    "evidence_document_id" TEXT,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_records" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "test_type" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "test_date" TIMESTAMP(3),
    "planned_date" TIMESTAMP(3),
    "score" DECIMAL(6,2),
    "subscores" JSONB,
    "target" DECIMAL(6,2),
    "evidence_document_id" TEXT,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "year" INTEGER,
    "season" TEXT,
    "category" TEXT,
    "registration_status" TEXT,
    "preparation" TEXT,
    "result" TEXT,
    "rank" TEXT,
    "award" TEXT,
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_projects" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mentor" TEXT,
    "role" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "methodology" TEXT,
    "output" TEXT,
    "publication" TEXT,
    "award" TEXT,
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT,
    "category" TEXT,
    "description" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "hours" DECIMAL(6,1),
    "impact" TEXT,
    "verifier_name" TEXT,
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_artifacts" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WritingStatus" NOT NULL DEFAULT 'DRAFT',
    "owner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_versions" (
    "id" TEXT NOT NULL,
    "artifact_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "change_summary" TEXT,
    "content" TEXT,
    "document_id" TEXT,
    "review_status" "WritingReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letters_of_recommendation" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "recommender_name" TEXT NOT NULL,
    "relationship" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "request_date" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "request_status" "LorRequestStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "submission_status" "LorSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "internal_notes" TEXT,
    "evidence_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letters_of_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessment_criteria_assessment_id_area_key" ON "assessment_criteria"("assessment_id", "area");

-- CreateIndex
CREATE INDEX "academic_records_case_id_idx" ON "academic_records"("case_id");

-- CreateIndex
CREATE INDEX "test_records_case_id_idx" ON "test_records"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_records_case_id_test_type_attempt_number_key" ON "test_records"("case_id", "test_type", "attempt_number");

-- CreateIndex
CREATE INDEX "competitions_case_id_idx" ON "competitions"("case_id");

-- CreateIndex
CREATE INDEX "research_projects_case_id_idx" ON "research_projects"("case_id");

-- CreateIndex
CREATE INDEX "activities_case_id_idx" ON "activities"("case_id");

-- CreateIndex
CREATE INDEX "writing_artifacts_case_id_idx" ON "writing_artifacts"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "writing_versions_artifact_id_version_number_key" ON "writing_versions"("artifact_id", "version_number");

-- CreateIndex
CREATE INDEX "letters_of_recommendation_case_id_idx" ON "letters_of_recommendation"("case_id");

-- CreateIndex
CREATE INDEX "tasks_milestone_id_idx" ON "tasks"("milestone_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "roadmap_milestones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_milestones" ADD CONSTRAINT "roadmap_milestones_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_milestone_dependencies" ADD CONSTRAINT "roadmap_milestone_dependencies_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "roadmap_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_milestone_dependencies" ADD CONSTRAINT "roadmap_milestone_dependencies_depends_on_milestone_id_fkey" FOREIGN KEY ("depends_on_milestone_id") REFERENCES "roadmap_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_projects" ADD CONSTRAINT "research_projects_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_artifacts" ADD CONSTRAINT "writing_artifacts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_versions" ADD CONSTRAINT "writing_versions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "writing_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_versions" ADD CONSTRAINT "writing_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters_of_recommendation" ADD CONSTRAINT "letters_of_recommendation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letters_of_recommendation" ADD CONSTRAINT "letters_of_recommendation_evidence_document_id_fkey" FOREIGN KEY ("evidence_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

