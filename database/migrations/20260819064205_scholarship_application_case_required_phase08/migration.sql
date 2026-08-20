-- DropForeignKey
ALTER TABLE "scholarship_applications" DROP CONSTRAINT "scholarship_applications_case_id_fkey";

-- AlterTable
ALTER TABLE "scholarship_applications" ALTER COLUMN "case_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

