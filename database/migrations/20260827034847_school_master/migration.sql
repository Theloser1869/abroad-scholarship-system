-- CreateTable (Client Acceptance Remediation DEC-05(b), 2026-08-27)
CREATE TABLE "school_masters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_masters_name_key" ON "school_masters"("name");

-- AlterTable (additive-only — existing "academic_records" rows keep school_master_id = NULL,
-- meaning "free text, not yet linked to any master row")
ALTER TABLE "academic_records" ADD COLUMN "school_master_id" TEXT;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_school_master_id_fkey" FOREIGN KEY ("school_master_id") REFERENCES "school_masters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
