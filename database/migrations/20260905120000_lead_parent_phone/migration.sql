-- AlterTable (2026-09-05 — Lead.parentPhone: additive-only, no existing data touched.
-- Distinguishes the parent/guardian's own phone from the existing `phone` column, which is
-- the student's own number.)
ALTER TABLE "leads" ADD COLUMN     "parent_phone" TEXT;
