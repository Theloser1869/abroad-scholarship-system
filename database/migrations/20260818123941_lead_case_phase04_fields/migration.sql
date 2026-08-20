-- AlterTable
ALTER TABLE "case_members" ADD COLUMN     "removed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cases" ADD COLUMN     "department" TEXT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "major_interest" TEXT;

