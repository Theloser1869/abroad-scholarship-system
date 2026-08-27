-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LiquidationStatus" AS ENUM ('PENDING', 'LIQUIDATED');

-- CreateTable
CREATE TABLE "closure_handover_records" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'PENDING',
    "handed_over_at" TIMESTAMP(3),
    "handed_over_by_id" TEXT,
    "recipient_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closure_handover_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidation_confirmations" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "status" "LiquidationStatus" NOT NULL DEFAULT 'PENDING',
    "company_confirmed_at" TIMESTAMP(3),
    "company_confirmed_by_id" TEXT,
    "student_parent_confirmed_at" TIMESTAMP(3),
    "student_parent_confirmed_by_id" TEXT,
    "liquidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidation_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closure_handover_records_case_id_key" ON "closure_handover_records"("case_id");

-- CreateIndex
CREATE UNIQUE INDEX "liquidation_confirmations_case_id_key" ON "liquidation_confirmations"("case_id");

-- AddForeignKey
ALTER TABLE "closure_handover_records" ADD CONSTRAINT "closure_handover_records_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_handover_records" ADD CONSTRAINT "closure_handover_records_handed_over_by_id_fkey" FOREIGN KEY ("handed_over_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_confirmations" ADD CONSTRAINT "liquidation_confirmations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_confirmations" ADD CONSTRAINT "liquidation_confirmations_company_confirmed_by_id_fkey" FOREIGN KEY ("company_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidation_confirmations" ADD CONSTRAINT "liquidation_confirmations_student_parent_confirmed_by_id_fkey" FOREIGN KEY ("student_parent_confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
