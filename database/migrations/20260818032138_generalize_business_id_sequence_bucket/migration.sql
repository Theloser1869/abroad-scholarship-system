/*
  Warnings:

  - The primary key for the `business_id_sequences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `year` on the `business_id_sequences` table. All the data in the column will be lost.
  - Added the required column `bucket` to the `business_id_sequences` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "business_id_sequences" DROP CONSTRAINT "business_id_sequences_pkey",
DROP COLUMN "year",
ADD COLUMN     "bucket" TEXT NOT NULL,
ADD CONSTRAINT "business_id_sequences_pkey" PRIMARY KEY ("prefix", "bucket");
