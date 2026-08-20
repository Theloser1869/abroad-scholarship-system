/*
  Warnings:

  - You are about to drop the column `response_status` on the `idempotency_keys` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "idempotency_keys" DROP COLUMN "response_status";
