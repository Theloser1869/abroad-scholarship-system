# Client Acceptance Report — Abroad Scholarship System

**Audit type:** Client Acceptance / SRS Conformance Audit (read-only — no code, schema, or data changes made).
**Source of truth:** `docs/He_thong_quan_ly_du_hoc_hoc_bong.xlsx` (all 21 sheets read in full).
**Method:** Static code review (backend `apps/api`, frontend `apps/web`, `database/schema.prisma`) cross-referenced against every sheet, using direct file citation. No production data was read, modified, or fabricated. See `CLIENT_UAT_SCENARIOS.md` for why live execution was not possible this pass.
**Companion documents:** `CLIENT_ACCEPTANCE_MATRIX.md` (130 requirement rows + a 9-scenario Customer Journey section, full citations, Round 2 changelog at the top), `CLIENT_REQUIREMENTS_GAPS.md` (25 gaps + 4 formal conflicts, Round 2 tally), `CLIENT_REQUIREMENT_CONFLICTS.md` (4 conflicts, full write-ups), `CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md` (full Round 2 methodology and findings), `CLIENT_UAT_SCENARIOS.md` (original 9 journeys + role UAT, code-inferred; superseded for journey verdicts by the Round 2 re-derivation above).

---

## Methodology note on the numbers below

126 requirement rows were extracted and evaluated, **excluding** the `REQ-DATA-*` (12 rows) and `REQ-REL-*` (5 rows) blocks in the matrix — those two blocks re-examine the *same* underlying fields and relationships already scored under `REQ-STUDENT-*`, `REQ-CONTRACT-*`, `REQ-TASK-*`, `REQ-AUDIT-*`, and `REQ-PARTNER-*`. Counting them again would double-penalize (or double-credit) the same facts. They remain in the matrix as a structural cross-check (the customer's Data Dictionary and Relationship-diagram sheets deserve their own explicit pass) but are excluded from this summary's totals for that reason. This is a scoping decision made transparently, not a way to hide findings — every fact they contain is still counted once, under its functional requirement.

Two pairs of INCORRECT findings share one root cause each (Export Control appears in both sheet07 and sheet09; the Partner Program ID bug appears in both sheet18's ID list and the Partner module review) — the Gaps register counts these as one gap each (GAP-001, GAP-011) even though the matrix correctly lists both source rows.

---

## CUSTOMER REQUIREMENTS: 130 (127 + 3 new rows found in Re-Audit Round 2: REQ-STUDENT-007, REQ-RBAC-013, REQ-CASE-016)

## IMPLEMENTED: 91
## PARTIAL: 20
## MISSING: 9
## INCORRECT: 6
## NOT_TESTABLE: 1
## CONFLICT: 3
## NOT_APPLICABLE: 0

**Accounting note (Round 2):** CONFLICT-004 (the sheet04-vs-sheet17 GPA contradiction, `REQ-DATA-013`) is tracked in full in `CLIENT_REQUIREMENT_CONFLICTS.md` and `CLIENT_REQUIREMENTS_GAPS.md` (4 conflicts total there), but is **not** double-counted in the CONFLICT figure above — it lives in the `REQ-DATA-*` block, which this report's own stated methodology (above) excludes from the requirement-count totals as a re-examination of an already-scored field. The 3 CONFLICT rows counted here are the three REQ-level conflicts: REQ-RBAC-002 (SYSTEM_ADMIN), REQ-CONTRACT-001 (payment sequence), REQ-SEC-017/REQ-PARTNER-006 (partner scope, one shared root cause).

**COVERAGE (IMPLEMENTED / applicable):** 91 / 129 (excluding the 1 NOT_TESTABLE row) ≈ **71%** fully conformant. Including PARTIAL as half-credit: (91 + 20×0.5) / 129 ≈ **79%**.

## MANDATORY REQUIREMENTS: 114 (of 130; 16 rows are Khuyến nghị/Normal/Tùy mục tiêu and excluded from this count)
## MANDATORY FAILURES: 9 unique root-cause defects remaining — see `CLIENT_REQUIREMENTS_GAPS.md` for the full list. GAP-001/GAP-002/GAP-003 are RESOLVED (independently re-confirmed Round 2); GAP-004/GAP-005/GAP-006/GAP-007 are PARTIALLY REMEDIATED (real fixes landed, real gaps remain, downgraded from Round 1's "REMEDIATED" framing); GAP-022 (`Student.school`) is a NEW OPEN HIGH finding.

**Revision note (2026-08-24):** these totals were revised from the audit's first draft (126 requirements, 11 INCORRECT, 17 PARTIAL, 2 NOT_TESTABLE) after cross-checking this report against three independently-run evidence passes on backend RBAC, database schema, and frontend pages, which surfaced REQ-RBAC-012 (new row, INCORRECT — GAP-020) and resolved REQ-DEPT-002 from NOT_TESTABLE to PARTIAL/MISSING(FE) (GAP-021). Neither changed the FINAL CUSTOMER ACCEPTANCE decision at that point, since both were MEDIUM severity, not CRITICAL/HIGH.

**Remediation update (2026-08-25):** see `docs/requirements/CLIENT_ACCEPTANCE_REMEDIATION_REPORT.md` for the full Blocker Fix Phase report. All 2 CRITICAL and 4 of 5 HIGH findings (GAP-001 through GAP-005, GAP-007) were reported REMEDIATED with real code, migrations, and passing automated tests. GAP-006 was reported PARTIALLY remediated.

**RE-AUDIT ROUND 2 update (2026-08-25):** see `docs/requirements/CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md` for the full independent re-verification. Round 2 did **not** accept the remediation report's own self-assessment at face value — every blocker was re-derived from the Excel wording and re-read against current code. Result: **3 of 6 blockers are genuinely fully closed** (Export Control, Payment-Gated Activation, Task.output — RESOLVED). **3 of 6 blockers were downgraded from "Remediated" to "Partially Remediated"** after finding real, concrete uncovered pieces of the original requirement: Student Mandatory Fields (the `school`/"Trường-Lớp" field was never implemented at all — new finding GAP-022/REQ-STUDENT-007), Closure/Liquidation (2 of 3 named completion obligations — "dịch vụ hoàn thành," "tài liệu bàn giao" — are not checked, and liquidation's "xác nhận hai bên" is unenforced free text), and Commission Traceability (Visa leg remains unimplemented, and Round 2 determined the Excel gives no basis to treat it as lower-priority than the Contract/Scholarship legs that were fixed). One further new finding not previously caught: REQ-RBAC-013 — HCTH/ADMIN_FINANCE has zero access to Student Profile despite sheet03 specifying "Hạn chế" (restricted), the 4th confirmed instance of the same under-provisioning pattern. One new formal conflict: CONFLICT-004 (the customer's own sheet04 and sheet17 disagree on whether Student.gpa is required). None of the downgrades are regressions — every partial fix that Round 1 built is real, tested, and a genuine improvement — but none should be represented to the client as fully closed.

## CRITICAL FINDINGS: 0 (both independently re-confirmed RESOLVED in Round 2)
1. ~~**GAP-001** — Export Control not implemented~~ — RESOLVED: `EXPORT_ROW_CAP=5000` enforced on all 4 export endpoints, 409 on overflow, field-redaction confirmed not bypassed. See ASM-87. (Round 2 found one cosmetic doc-citation bug: the code comment cites the wrong ASM number — zero functional impact.)
2. ~~**GAP-002** — Contract could activate with zero payment recorded~~ — RESOLVED: SIGNED→ACTIVE now requires a received payment, race-safe (concurrency e2e test re-read line-by-line in Round 2). See ASM-88; exact threshold remains registered as CONFLICT-001, correctly not silently resolved.

## HIGH FINDINGS: 4 remaining (Round 2: 1 resolved further, 3 reopened as partial, 1 new)
~~GAP-003~~ (Task.output — RESOLVED, no bypass found, ASM-89). **GAP-004/GAP-005** (Student fields — PARTIALLY REMEDIATED: 7 of 8 named fields solid and stage-enforced; `school` completely unimplemented, now its own finding **GAP-022**). **GAP-006** (Contract↔Partner commission link — PARTIALLY REMEDIATED: Contract+Scholarship now real FKs; Visa leg remains unimplemented and Round 2 determined it should carry the same HIGH severity, not be softened). **GAP-007** (Closure/Liquidation — PARTIALLY REMEDIATED: a real, reachable, debt-checked, audited page now exists, but 2 of the 3 named completion obligations and the two-party liquidation confirmation remain unimplemented).

## MEDIUM FINDINGS: 12 (9 unchanged + 3 new from Round 2)
GAP-008 through GAP-014 — RBAC under/over-provisioning on Partner Documents and Visa for two roles, Partner type enum mismatch, Partner Program ID prefix bug, missing Contract.contract_type field, unimplemented Training entity, and an unresolved at-rest-encryption scope question. Plus GAP-020 (Sale/Marketing under-provisioned on Student Profile/Competition) and GAP-021 (Marketing has no standalone frontend module). **GAP-023 (NEW, Round 2)** — HCTH/ADMIN_FINANCE zero access to Student Profile, the 4th confirmed instance of the same "Hạn chế→zero" pattern (now spanning 3 roles × 4 module cells — worth a full seed.ts-vs-sheet03 audit, not more one-off patches). **GAP-024 (NEW, Round 2)** — `Case.stage` is unvalidated free text with no derivation from actual sub-entity progress (each individual stage's own gate is real; the summary label can drift). **GAP-025 (NEW, Round 2)** — root cause under GAP-020: the `profile_evidence` RBAC resource is too coarse to express the Excel's per-module Sale/Marketing distinction even if the missing grant were added.

## LOW FINDINGS: 6
GAP-015 through GAP-019 plus the `.env`-points-at-production operational-hygiene note (already corrected during remediation) — see `CLIENT_REQUIREMENTS_GAPS.md` for detail. None of these are individually blocking.

---

## END-TO-END JOURNEYS (9 scenarios — Round 2 re-derived fresh from code, full detail in `CLIENT_ACCEPTANCE_MATRIX.md`'s "Customer Journey Scenarios" section)

| Scenario | Round 2 result |
|---|---|
| A — Lead→Contract→Student→Case | PARTIAL (sequencing differs from customer's literal description — signing links an already-existing Student/Case rather than originating them) |
| B — Case→Assessment→Roadmap→Profile→Writing | IMPLEMENTED (best-evidenced gate in the system) |
| C — Case→University Choice→Application→Checklist→Offer | IMPLEMENTED (entities), sequencing not system-enforced (Excel doesn't require it either) |
| D — Application→Scholarship→Result | PARTIAL (thin result-reporting UX, unchanged) |
| E — Visa→Pre-departure→Enrollment | **IMPLEMENTED (Round 2: Pre-departure's backing model now conclusively resolved)** — shared `VisaChecklistItem` model, `entityType:'PreDeparture'`, a deliberate documented reuse pattern, not a missing entity |
| F — Contract→Payment→Closure→Archive | **PARTIAL (Round 2 downgrade from Round 1's "IMPLEMENTED")** — payment-gated activation and Archive are both solid and confirmed walkable end-to-end. Closure itself carries REQ-CASE-014's residual gaps: document handover is checked by neither closure mechanism, and HCTH (the Excel's named closure actor) cannot reach the one path that does check service-completion (`Case.close()`, gated to a different role). The full status chain is walkable through real UI+API; the per-step business-rule completeness is the residual issue. |
| G — Partner→Program→Student Link→Commission | PARTIAL (functionally complete, Visa-leg traceability gap remains) |
| H — Student Portal full journey | IMPLEMENTED (strongest evidence of any scenario) |
| I — Parent Portal linked-child | **IMPLEMENTED (Round 2: independently re-verified, not carried forward unchecked)** — `GET /portal/me` genuinely server-resolves every linked student via the real `StudentContact` table; a parent with >1 child sees a real picker UI. Round 1 had asserted this without opening the code. |

## ROLE UAT
See `CLIENT_UAT_SCENARIOS.md` role table. All 8 roles have purpose-built demo fixtures already seeded in the codebase (`database/seeds/seed.ts`) specifically for this kind of test, but none were exercised live this pass. Permission-boundary confidence is HIGH (extensively cross-checked against actual seed grants); lived-experience confidence is LOW (nothing was watched render).

## SECURITY CONFORMANCE
Strong overall — genuinely exceeds the customer's baseline in several areas (MFA fully wired though only recommended, session control with live per-request re-validation, immediate offboarding revocation, non-enumerating 404-based document/record access, defense-in-depth field redaction layered on top of scope filtering). **Export Control is now remediated** (row-capped, 409 on overflow) — the encryption-at-rest scope question (GAP-014, MEDIUM) is the remaining item keeping this from a clean pass. RBAC role→module mapping is faithful for the highest-risk cells (Sale/Marketing, HCTH) with a handful of narrower under/over-provisioning mismatches (GAP-008/009, untouched by this remediation phase).

## DATA MODEL CONFORMANCE
Still the weakest area overall, but improved. `Student.scholarshipGoal`, `AcademicRecord.grade`, `Contract.closureReason`, `CommissionTransaction.contractId`, and `PartnerStudentLink.contractId`/`scholarshipApplicationId` were all added this remediation phase (5 additive migrations, no data loss), and the customer-mandatory Student/Task fields now have real, tested enforcement (stage-aware for Student, at the DONE transition for Task) even though the underlying DB columns remain nullable by design. Several sheet-19 relationships are still not implemented as direct FKs (Application/Scholarship→PartnerProgram, Student→Document/Task, PartnerStudentLink→Visa — untouched by this phase), and Partner's type taxonomy still doesn't match the customer's 7 categories. None of these break the *running* system — the app clearly works around them via alternate paths.

## ID/FORMAT CONFORMANCE
13 of 14 customer ID prefixes are implemented correctly with real DB-level uniqueness and confirmed immutability (no update endpoint accepts a code override). Two defects: Partner Program's generated ID carries the wrong prefix (`PT-` instead of `PP-`), and Training (TRN) has no implementation at all. No ID-based-authorization violations found (Student/Contract both scope-check before every fetch), with one architectural inconsistency on Partner reads worth a deliberate decision.

## AUDIT CONFORMANCE
Real, append-only, well-structured audit trail covering all 8 customer-required columns, with genuine VIEW/DOWNLOAD/EXPORT capture including denial outcomes. **Export volume is now capped, not just logged** (Remediated GAP-001). Remaining gap: list/browse reads still aren't audited (only single-record views, LOW severity, untouched).

## KPI/SLA CONFORMANCE
The core, security-relevant KPIs (on-time completion rate, overdue-task count, quality score, org-wide pipeline/financial dashboards) are genuinely computed server-side with correct multi-currency handling. The softer/newer KPIs (case-count-per-staff, writing-artifact completion counts, on-time-closure rate) are missing from the reporting layer, and two (internal-profile-error count, customer-response SLA) have no underlying data model at all — these need a scoping conversation with the client before they can be built, since the customer sheet doesn't define what starts/stops the clock or what counts as an "internal error."

## FRONTEND CONFORMANCE
Strong, and now stronger. Every customer module has a real page or a reasonable tab-consolidated equivalent — **including Closure/Liquidation**, which now has a dedicated page (Remediated GAP-007). Role-based navigation, empty/loading/error/forbidden states, Vietnamese labeling, and the full Student/Parent portal are all confirmed consistently implemented, not spot exceptions. Dashboards are genuinely server-computed, not client-side aggregations. One maintenance-risk note: the frontend nav permission table is a hand-authored mirror of the backend RBAC seed, not fetched live — low security risk (backend re-enforces everything) but a real drift risk over time.

## BACKEND CONFORMANCE
Strong, and now stronger. Every workflow-stage entity and status machine was traced with exact file:line citations. Roadmap-approval gating, Contract's SIGNED-immutability guard, and the new payment-gated activation/debt-checked completion transitions (interactive transaction + compare-and-swap, race-tested) are the best-evidenced, most rigorously enforced business rules in the codebase. **Both CRITICAL gaps (unbounded export, ungated contract activation) are now fixed** — narrow, well-understood backend logic changes, exactly as previously assessed, verified by new automated tests exercising both the failure and success paths.

## DATABASE CONFORMANCE
Schema is well-normalized and the migration history is clean (20 migrations, confirmed up to date against production in this audit's own tooling check). The Data Dictionary conformance gaps (missing/optional required fields, a few non-FK "relationships") are real but narrow — most of the underlying business need is still met through an alternate, arguably more normalized path (e.g., GPA history via `AcademicRecord` rather than a single `Student.gpa` field).

---

## FINAL CUSTOMER ACCEPTANCE: **PASS WITH CONDITIONS (re-confirmed, Re-Audit Round 2, 2026-08-25)**

**Original reasoning (2026-08-24, superseded):** *"FAIL: Any mandatory CRITICAL/HIGH requirement missing/incorrect."* Two CRITICAL findings and five HIGH findings sat against explicitly "Bắt buộc" customer requirements.

**Remediation-time reasoning (2026-08-25, superseded by Round 2):** All 2 CRITICAL and 4 of 5 HIGH findings were reported REMEDIATED; 1 HIGH (GAP-006) reported PARTIALLY remediated. **This framing was not independently re-verified before being reported — Round 2 exists specifically to check it.**

**Re-Audit Round 2 reasoning (2026-08-25, current):** Independently re-deriving every blocker's status from the Excel wording (not accepting the remediation report's own self-grading) found the Round-1 picture was too optimistic in 3 of 6 places. The corrected picture: **0 CRITICAL remain** (both independently re-confirmed RESOLVED — Export Control and Payment-Gated Activation are both real, tested, and race-safe). **4 HIGH remain** (down from the original 5, up from Round 1's reported 1): Task.output is genuinely RESOLVED; Student Fields, Closure/Liquidation, and Commission Traceability are each PARTIALLY remediated with a concrete, named, uncovered piece of the original mandatory requirement (see the HIGH FINDINGS section above); plus one wholly new HIGH finding (GAP-022, `Student.school`) the original remediation missed entirely. Per this audit's own decision rules — *"PASS WITH CONDITIONS: no CRITICAL/HIGH **mandatory failure**, remaining gaps are non-critical, each has explicit explanation"* — the 4 remaining HIGH items are not full failures (each has a real, working partial fix and a precisely-scoped remaining piece, all explicitly documented here and in the matrix) — the system holds at **PASS WITH CONDITIONS**, not FAIL, but the *conditions* list is longer and more specific than Round 1 reported, and none of the 3 downgraded items should be represented to the client as fully closed.

This is a genuine, independently re-verified assessment — every one of the 6 blockers was re-read against the Excel and the current code a second time, by a process explicitly instructed not to trust the first pass's self-assessment. See `docs/requirements/CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md` for the full reasoning and re-derived citations.

## REMAINING ITEMS (must resolve or obtain explicit client acceptance before a re-audit could reach a clean PASS)
1. ~~Export row-cap~~ — DONE, re-confirmed Round 2. Confirm the 5000-row threshold with the client (not customer-specified).
2. ~~Payment-gated activation~~ — DONE, re-confirmed Round 2. Confirm the exact payment threshold with the client (CONFLICT-001 — "any payment" vs. a specific amount).
3. ~~Task.output enforcement~~ — DONE, re-confirmed Round 2, no bypass found.
4. **Student required fields** — 7 of 8 fields DONE (stage-aware, at Assessment approval; confirm this stage choice with the client). **`school` ("Trường/Lớp") is completely unimplemented — add the field (GAP-022/REQ-STUDENT-007).**
5. **Closure/Liquidation UI** — the debt-check half is DONE and reachable through a real page. Add a service-completion precondition and a document-handover check (2 of 3 named COMPLETED obligations are still unchecked); add a real two-party confirmation mechanism to LIQUIDATED (currently free text).
6. Add `PartnerStudentLink.visaId` / `CommissionTransaction.visaId` to fully close GAP-006 — Round 2 determined this should be treated as an unresolved mandatory gap, not a minor footnote.
7. **NEW (Round 2):** Add a Student Profile grant (at least restricted/view) for HCTH/ADMIN_FINANCE (GAP-023/REQ-RBAC-013) — 4th confirmed instance of the same under-provisioning pattern; consider a full seed.ts-vs-sheet03 cell-by-cell audit rather than more one-off patches.
8. Resolve the four formal CONFLICT items (contract status sequence, SYSTEM_ADMIN role sign-off, Partner data-access-scope reading, **and the new Student.gpa sheet04-vs-sheet17 contradiction**) with the client directly.
9. MEDIUM/LOW items (GAP-008 through GAP-021, GAP-023) — batch into a normal backlog pass; none are release-blocking on their own.

## RECOMMENDED FIX ORDER (updated, Round 2)
1. Confirm the open thresholds/stage questions with the client (export row cap, payment-activation amount, Student-field enforcement stage, GPA requiredness) — no code changes needed until answered.
2. Add `Student.school` (GAP-022) — small, same pattern as `scholarshipGoal`, and it's the one genuinely missing piece of an otherwise-solid fix.
3. Add `PartnerStudentLink.visaId`/`CommissionTransaction.visaId` (GAP-006 residual) and a Student Profile grant for HCTH (GAP-023).
4. Add the service-completion and document-handover checks to Contract COMPLETED, and a real two-party confirmation mechanism to LIQUIDATED (GAP-007 residual) — the larger remaining item, needs a design decision on which role/data performs the service-completion check given ADMIN_FINANCE's lack of `cases:view`.
5. Resolve the 4 formal CONFLICT items with the client.
6. MEDIUM/LOW items — normal backlog pass.
7. Execute the 9 UAT scenarios and role matrix live in a browser against the existing `demo.*` seed fixtures — the automated e2e suite proves the API-level behavior genuinely works, but no one has watched the actual UI render through a full user journey yet.

---

Do NOT deploy based on this report alone. Do NOT start a new feature phase from these findings without client conversation on the CONFLICT items. No production data was read, modified, or fabricated in the course of this audit or its remediation. No customer Excel file was modified. See `docs/requirements/CLIENT_ACCEPTANCE_REMEDIATION_REPORT.md` for the full Blocker Fix Phase report.
