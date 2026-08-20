-- DropIndex
DROP INDEX "leads_converted_student_id_key";

-- CreateIndex
CREATE INDEX "leads_converted_student_id_idx" ON "leads"("converted_student_id");

