-- CreateEnum
CREATE TYPE "TaskTemplateTrigger" AS ENUM ('CASE_CREATED', 'CASE_STAGE_CHANGED', 'CONTRACT_ACTIVATED');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "source_entity_id" TEXT,
ADD COLUMN     "source_entity_type" TEXT,
ADD COLUMN     "template_id" TEXT;

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priority" TEXT,
    "deadline_offset_days" INTEGER,
    "trigger_event" "TaskTemplateTrigger" NOT NULL,
    "trigger_stage_value" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_code_key" ON "task_templates"("code");

-- CreateIndex
CREATE INDEX "task_templates_trigger_event_idx" ON "task_templates"("trigger_event");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_template_id_source_entity_type_source_entity_id_key" ON "tasks"("template_id", "source_entity_type", "source_entity_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

