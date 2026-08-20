-- CreateEnum
CREATE TYPE "ExternalSyncStatus" AS ENUM ('NOT_SYNCED', 'SYNCED', 'MANUAL_OVERRIDE');

-- CreateEnum
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "original_filename" TEXT,
ADD COLUMN     "previous_version_id" TEXT,
ADD COLUMN     "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "retrieved_at" TIMESTAMP(3),
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "sync_status" "ExternalSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED';

-- AlterTable
ALTER TABLE "scholarship_masters" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "retrieved_at" TIMESTAMP(3),
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "sync_status" "ExternalSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED';

-- AlterTable
ALTER TABLE "universities" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "retrieved_at" TIMESTAMP(3),
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "sync_status" "ExternalSyncStatus" NOT NULL DEFAULT 'NOT_SYNCED';

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupe_key" TEXT,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "correlation_id" TEXT,
    "scheduled_for" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incoming_webhook_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "incoming_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "background_jobs_dedupe_key_key" ON "background_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "background_jobs_status_scheduled_for_idx" ON "background_jobs"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "background_jobs_job_type_idx" ON "background_jobs"("job_type");

-- CreateIndex
CREATE UNIQUE INDEX "incoming_webhook_events_source_event_id_key" ON "incoming_webhook_events"("source", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_previous_version_id_key" ON "documents"("previous_version_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

