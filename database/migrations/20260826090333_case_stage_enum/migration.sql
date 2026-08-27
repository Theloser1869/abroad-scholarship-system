-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('LEAD_TO_CONTRACT', 'CONTRACT_SIGNING', 'ASSESSMENT', 'ROADMAP', 'PROFILE_DEVELOPMENT', 'WRITING', 'SCHOOL_SELECTION', 'APPLICATION', 'OFFER', 'SCHOLARSHIP', 'VISA', 'PRE_DEPARTURE', 'ENROLLMENT', 'CLOSURE', 'ARCHIVE');

-- Data migration (REQ-CASE-016, Client Acceptance Remediation 2026-08-26): map every existing
-- free-text "cases"."stage" value onto the new controlled enum before the column type changes.
-- 'intake'/'counseling' -> CONTRACT_SIGNING (a Case row always starts life before its Contract
-- is signed); 'assessment' -> ASSESSMENT; any other stray legacy value (e.g. e2e test markers,
-- none of which are relied on by real business logic) -> CONTRACT_SIGNING as a safe fallback.
UPDATE "cases" SET "stage" = CASE "stage"
  WHEN 'intake' THEN 'CONTRACT_SIGNING'
  WHEN 'counseling' THEN 'CONTRACT_SIGNING'
  WHEN 'assessment' THEN 'ASSESSMENT'
  ELSE 'CONTRACT_SIGNING'
END;

-- AlterTable
ALTER TABLE "cases" ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "CaseStage" USING ("stage"::"CaseStage"),
  ALTER COLUMN "stage" SET DEFAULT 'CONTRACT_SIGNING';
