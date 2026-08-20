-- Phase 13 QA fix — SRS §8 lists business-ID formats COMP-YYYY-NNNNN (Competition) and
-- RES-YYYY-NNNNN (Research) alongside every other core entity; these two were the only
-- ones never given a generated code (traceability audit finding D1). Additive only:
-- nullable column -> backfill any pre-existing rows (deterministic, per-creation-year
-- sequential, keeping business_id_sequences in sync so IdGeneratorService continues the
-- same counter afterward) -> NOT NULL -> UNIQUE. Safe against an empty table (no rows to
-- backfill) and against a table with existing dev/test fixture rows alike.

ALTER TABLE "competitions" ADD COLUMN "competition_code" TEXT;
ALTER TABLE "research_projects" ADD COLUMN "research_code" TEXT;

WITH numbered AS (
  SELECT id, EXTRACT(YEAR FROM created_at)::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS rn
  FROM "competitions"
)
UPDATE "competitions" c
SET "competition_code" = 'COMP-' || numbered.yr || '-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered
WHERE c.id = numbered.id;

INSERT INTO "business_id_sequences" (prefix, bucket, last_value, updated_at)
SELECT 'COMP', EXTRACT(YEAR FROM created_at)::int::text, COUNT(*), now()
FROM "competitions"
GROUP BY EXTRACT(YEAR FROM created_at)
ON CONFLICT (prefix, bucket) DO UPDATE SET last_value = GREATEST("business_id_sequences".last_value, EXCLUDED.last_value);

WITH numbered AS (
  SELECT id, EXTRACT(YEAR FROM created_at)::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS rn
  FROM "research_projects"
)
UPDATE "research_projects" r
SET "research_code" = 'RES-' || numbered.yr || '-' || LPAD(numbered.rn::text, 5, '0')
FROM numbered
WHERE r.id = numbered.id;

INSERT INTO "business_id_sequences" (prefix, bucket, last_value, updated_at)
SELECT 'RES', EXTRACT(YEAR FROM created_at)::int::text, COUNT(*), now()
FROM "research_projects"
GROUP BY EXTRACT(YEAR FROM created_at)
ON CONFLICT (prefix, bucket) DO UPDATE SET last_value = GREATEST("business_id_sequences".last_value, EXCLUDED.last_value);

ALTER TABLE "competitions" ALTER COLUMN "competition_code" SET NOT NULL;
ALTER TABLE "research_projects" ALTER COLUMN "research_code" SET NOT NULL;

CREATE UNIQUE INDEX "competitions_competition_code_key" ON "competitions"("competition_code");
CREATE UNIQUE INDEX "research_projects_research_code_key" ON "research_projects"("research_code");
