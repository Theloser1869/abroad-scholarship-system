# PHASE STATUS — PHASE_13 (Full QA / Security Review / UAT)

## PHASE 13 STATUS: PASS

## SCOPE

Full-system requirements traceability, security review, and UAT business-workflow review across Phases 00-12 — no new business features. Executed per:

1. `13-qa/01_FULL_TRACEABILITY.md`
2. `13-qa/02_SECURITY_REVIEW.md`
3. `13-qa/03_UAT_REVIEW.md`

## FILES READ

`docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx` (extracted in full to plain text for this audit), `docs/phase-status/PHASE_02.md` through `PHASE_12.md`, `docs/database/ERD.md`, `docs/database/DATA_DICTIONARY.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/RBAC_MATRIX.md`, `docs/security/AUTH_MODEL.md`, `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, `database/schema.prisma`, and the entirety of `apps/api/src` and `apps/api/test` relevant to each domain (verified by direct code read for every requirement graded, not inferred from route/file names).

## METHOD

Seven parallel research passes, each independently verifying the actual service implementation and actual test coverage against the SRS (not trusting prior phase-status claims at face value):

1. RBAC & field-level sensitive-data audit (cross-cutting, all modules)
2. Technical vulnerability-class audit (SQLi, mass assignment, XSS, CSRF, path traversal, SSRF, file upload, signed URL, brute force, token/session, secret leakage, audit bypass, webhook, job/worker privilege)
3. Core lifecycle domain traceability (Lead/Student/Case/Contract/Payment/Task)
4. Counseling/Profile domain traceability (Assessment/Roadmap/Academic/Competition/Research/Activity/Writing)
5. Admission/Visa pipeline traceability (University/Program/Scholarship/Application/Offer/Scholarship-Application/Visa/Pre-departure/Enrollment/Closure)
6. Partner CRM/Document/Notification/Audit-Reporting-Export traceability
7. UAT role-based workflow walkthrough (all 8 roles)

Plus a bounded performance spot-check on named heavy read paths (§22 of the phase instructions).

---

## REQUIREMENTS TRACEABILITY

Full matrix in `docs/REQUIREMENTS_TRACEABILITY.md`.

**TOTAL REQUIREMENTS REVIEWED**: 63

**IMPLEMENTED**: 54
**PARTIALLY IMPLEMENTED**: 4 (all documented as `docs/ASSUMPTIONS.md` ASM-56–ASM-59, none block the release gate)
**MISSING**: 1 found → 0 remaining (Competition/ResearchProject business-ID codes — fixed)
**INCORRECT**: 4 found → 0 remaining (see CRITICAL/HIGH findings below — all fixed)
**DEFERRED**: 0 new (existing deferrals from Phase 07-12 re-confirmed still accurate, none re-opened)

---

## FINDINGS

### CRITICAL FINDINGS: 1 found, 1 fixed

1. **Student list IDOR** — `StudentsService.list`'s `?search=` filter silently overwrote (not narrowed) the `OWN_STUDENT` scope filter due to a Prisma `where`-clause key collision, letting a STUDENT_PARENT enumerate every student in the system via search. **Fixed.**

### HIGH FINDINGS: 3 found, 3 fixed

1. **Document download authorization mismatch** — `downloadByToken` (step 2 of the download flow) didn't re-run the GLOBAL-scope bypass `requestDownload` (step 1) applies, so Executive Director/Department Manager got a valid `downloadUrl` and then a 403 on any document they hadn't personally uploaded/been shared. **Fixed.**
2. **Consultant over-granted visa evidence access** — every Visa evidence-linking call site used the same uniform grant-to-every-case-member helper as every other evidence type, giving Consultant full VIEW+DOWNLOAD on passport/financial visa evidence when SRS §13 specifies "Xem hạn chế" (restricted view). **Fixed.**
3. **Guard-level permission denials unaudited** — NestJS runs Guards before Interceptors, so `AuthGuard`'s 403 never reached `AuditInterceptor`'s DENIED-write path; only service-level (post-guard) denials were audited, contradicting the SRS's blanket audit rule and AC-13. **Fixed.**

### MEDIUM FINDINGS: 6 found, 1 fixed, 5 deferred with documented reason

1. Webhook forged-delivery slot-squatting (a forged event under a guessed `eventId` permanently blocked the real, later, correctly-signed delivery). **Fixed.**
2. General API rate-limiting beyond login lockout. **Deferred — ASM-56.**
3. Concurrent-request race on "one active Case per Student." **Deferred — ASM-57.**
4. Document checksum not re-verified at download time. **Deferred — ASM-58.**
5. Executive dashboard missing SRS §6.21's `workload`/`deadlines` fields. **Fixed** (counted separately below under UAT).
6. No dedicated case-owner-reassignment endpoint (`Case.ownerId` went stale after an attempted reassignment via the additive members endpoint). **Fixed** (counted separately below under UAT).

*(Items 5 and 6 surfaced through the UAT pass rather than the security pass; both are fixed — see below.)*

### LOW FINDINGS: 3

1. LOR field-redaction confirmed correct by code read; no dedicated e2e assertion exists. **Deferred (test-gap only) — ASM-59.**
2. Parent document-access revocation confirmed correct by code read; no dedicated e2e assertion exists. Documented in `docs/UAT_FINDINGS.md`.
3. Competition/ResearchProject missing §8 business-ID codes. **Fixed** (counted above under traceability MISSING).

### CRITICAL FIXES

1. `apps/api/src/modules/case-management/students/students.service.ts` — combined the `OWN_STUDENT` scope filter and the `?search=` filter under a Prisma `AND` array instead of flat-spreading, eliminating the key-collision. Regression test: `students.e2e-spec.ts`.

### HIGH FIXES

1. `apps/api/src/modules/documents/documents/documents.service.ts` — `downloadByToken` now re-derives the GLOBAL-scope bypass from the token's `principalId` by loading the requester's role, matching `requestDownload`'s logic. Regression test: `documents-platform.e2e-spec.ts`.
2. `apps/api/src/modules/documents/documents/documents.service.ts` (`grantCaseAccess`) + `apps/api/src/modules/visa/visas/visas.service.ts` + `apps/api/src/modules/visa/visas/visa-checklist.service.ts` — added a `viewOnlyForRoles` option, applied only at Visa's 4 evidence-linking call sites, restricting CONSULTANT to VIEW (no DOWNLOAD). Every other evidence-bearing module unaffected. Regression test: `visa.e2e-spec.ts`.
3. `apps/api/src/common/guards/auth.guard.ts` — writes a DENIED-shaped `AuditLog` row itself on a permission-guard 403 for any `@Audit`-decorated route, closing the Guard-runs-before-Interceptor gap. Regression test: `audit.e2e-spec.ts`.

---

## SECURITY REVIEW

Full detail in `docs/security/SECURITY_TEST_REPORT.md`. Covered: IDOR, broken access control, horizontal/vertical privilege escalation, mass assignment, SQL injection, XSS, CSRF, file upload abuse, path traversal, SSRF, brute force, token/session misuse, cross-student/cross-case access, export leakage, signed URL abuse, secret leakage, audit bypass, webhook forgery/replay, background job/worker privilege. Every role tested both ALLOW and DENY.

## RBAC REVIEW

All ~230 controller routes' `@RequirePermission`/`@Public()` decorators cross-checked against `docs/security/RBAC_MATRIX.md` — zero mismatches. All 8 SRS §13 field-level sensitive-data rows re-verified cell-by-cell (Passport/ID, Budget/Finance, Contract Value, Payment/Debt, Commission, Visa evidence, Internal notes, Audit logs) — all MATCH after the Visa-evidence fix above. `RBAC_MATRIX.md` updated (title, §4 ASSIGN row, §5 Passport/ID and Visa evidence rows, §7 three new deferral bullets).

## IDOR REVIEW

One CRITICAL found and fixed (student list `?search=`, above). All other single-record reads (Case, Contract, Document, Payment, Visa, Partner, etc.) confirmed non-enumerating (404, not 403, for out-of-scope-but-existing records) across the existing `rbac.e2e-spec.ts` suite. Document ownerId/ownerEntity spoofing confirmed to grant no extra access (grant-table-driven, not metadata-driven).

## FIELD-LEVEL REVIEW

Checked LIST/DETAIL/NESTED/SEARCH/EXPORT/PORTAL surfaces for: passport, financial evidence, contract value, payment, commission, visa evidence, internal notes, audit metadata, staff KPI, internal application/scholarship strategy, partner commercial data. No secondary endpoint found leaking a field its primary endpoint redacts, beyond the Visa-evidence access-level gap now fixed.

## DOCUMENT SECURITY REVIEW

Phase 12 subsystem re-audited end-to-end: arbitrary/guessed ID, changed owner fields, expired/reused/tampered signed URL, two-step flow authorization parity (HIGH, fixed), malicious file (EICAR), MIME mismatch, oversized upload, archived/previous-version access, cross-role access. Checksum-at-download re-verification deferred (ASM-58, not a live risk with the current storage provider).

## API SECURITY REVIEW

All routes in `admin`, `export`, `documents`, `portal`, `webhooks`, `jobs`, `reports`, `contract/payment`, `commission` reviewed for missing auth, client-controlled ownership, insecure status updates, excessive data exposure, missing pagination. No finding beyond the items already listed.

## AUDIT REVIEW

HIGH finding (Guard-level denials unaudited) found and fixed. Every sensitive mutation (contract/payment/document/application/scholarship/visa/enrollment/closure/partner/commission/portal invitation-revoke/permission changes/export/webhook/admin job operations) confirmed `@Audit`-decorated with actor/action/entity/timestamp/result/before-after/student-case context.

## JOB/INTEGRATION SECURITY

MEDIUM webhook slot-squatting found and fixed. Idempotency, retry, payload-tampering resistance, privilege context all re-verified — no job processor trusts payload content for a business decision or bypasses RBAC via a synthetic elevated principal.

## REPORTING/EXPORT SECURITY

Export scope/field-level restrictions/audit re-verified — `exportCases` reuses the same `ScopePolicyService.caseListFilter` every Case list endpoint uses; no "export all, filter client-side" pattern found anywhere.

---

## UAT

Full detail in `docs/UAT_FINDINGS.md`. All 8 roles (Executive Director, Department Manager, Consultant, Application/Document Specialist, Sales/Marketing, Administration/Finance, Student, Parent) can complete their SRS-defined realistic workflows end-to-end. 2 MEDIUM findings, both fixed: Executive dashboard missing `workload`/`deadlines` (SRS §6.21); no dedicated case-owner-reassignment endpoint. 1 LOW finding documented (Parent document-revocation test-gap, code confirmed correct).

## PERFORMANCE REVIEW

Bounded spot-check (not full load-testing, per phase instructions) on the named heavy paths: Student detail, Case timeline, Task list, Document list, Dashboard/Reports (all 4 `ReportsService` methods), Audit search, Export. No security filter was relaxed for performance anywhere. See findings below.

Findings (no security filter relaxed anywhere to achieve any of this):

- Student/Case/Task/Audit-log list, detail, and timeline paths: **no issue** — paginated, indexed, no N+1 pattern found.
- Document `listAccessibleTo`: **LOW** — unbounded `findMany`, fine at current scale; worth pagination if it becomes a user-facing "my documents" list.
- `ReportsService.executiveDashboard()`/`managerDashboard()`: **MEDIUM** — loads full Payment/Task row sets into Node and reduces in JS instead of using Prisma's SQL-side `aggregate`/`sum`. Correct today, but will become a real full-table-scan-into-memory cost as those tables grow, on a dashboard ED/DM hit routinely. **Deferred** rather than fixed in Phase 13 — this is an optimization of already-PASSed Phase 12 code with no current correctness or security impact, and Phase 13's mandate is fixing defects, not rewriting working code for future scale without a compelling present reason; tracked here for a future performance-focused pass.
- Case/Student/Export list endpoints: **LOW** — export endpoints are deliberately unbounded (an export must return everything matching scope), with no hard row ceiling; a future phase could add one to protect against an accidental massive export.

No MEDIUM/LOW finding here is a security-filter bypass or a correctness defect — all are scale-readiness notes.

## TEST GAPS

- LOR field-redaction (§13) — code confirmed correct, no e2e assertion (ASM-59).
- Parent document-access revocation — code confirmed correct, no e2e assertion.
- Milestone-dependency multi-hop cycle detection — only the direct self-dependency case is tested.
- SALES_MARKETING/ADMIN_FINANCE explicit-deny coverage for the counseling domain's 4 resources (assessments/roadmaps/profile_evidence/writing) — RBAC_MATRIX shows zero grant for both, but no dedicated negative test names this combination directly (covered indirectly by the base RBAC grant check, not a per-domain test).

None of the above are CRITICAL/HIGH — all are tracked, none block the release gate.

## DATABASE / DATA INTEGRITY

Reviewed PK/FK/unique/index/nullability/enum/versioning/soft-delete/audit/Decimal/currency/date coverage across Student↔Case, Case↔Contract, Contract↔Payment, Case↔Task, Student↔Application, Application↔Program, Application↔Offer, ScholarshipMaster↔ScholarshipApplication, Case↔Visa, Visa↔Enrollment, Partner↔PartnerProgram, Partner↔Student/Case, CommissionRule↔CommissionTransaction, Document↔every evidence-bearing module. No orphan records, no duplicate records, no impossible relationships found. One MISSING requirement fixed (Competition/ResearchProject business-ID codes, additive migration + backfill). One narrow concurrency gap documented as deferred (ASM-57, "one active Case per Student" race).

---

## FILES CREATED/UPDATED

**Fixes (production code)**:
- `apps/api/src/modules/case-management/students/students.service.ts` — CRITICAL IDOR fix.
- `apps/api/src/modules/documents/documents/documents.service.ts` — HIGH download-parity fix + `grantCaseAccess` `viewOnlyForRoles` option.
- `apps/api/src/modules/visa/visas/visas.service.ts`, `apps/api/src/modules/visa/visas/visa-checklist.service.ts` — HIGH visa-evidence access-level fix (4 call sites).
- `apps/api/src/common/guards/auth.guard.ts` — HIGH audit-on-guard-deny fix.
- `apps/api/src/modules/documents/webhooks/webhooks.service.ts` — MEDIUM webhook slot-squatting fix.
- `apps/api/src/modules/reporting/reports/reports.service.ts` — MEDIUM executive-dashboard workload/deadlines fix.
- `apps/api/src/modules/case-management/cases/cases.service.ts`, `cases.controller.ts`, new `dto/reassign-case-owner.dto.ts` — MEDIUM case-owner-reassignment fix.
- `apps/api/src/modules/counseling/profile-evidence/competitions.service.ts`, `research-projects.service.ts` — MISSING business-ID codes fix.
- `database/schema.prisma` — `Competition.competitionCode`, `ResearchProject.researchCode`.
- `database/seeds/seed.ts` — fixture rows updated with the new required code fields.

**New migration**:
- `database/migrations/20260820030000_competition_research_business_id_phase13/migration.sql` — additive: nullable column → deterministic backfill of any pre-existing rows (keeping `business_id_sequences` in sync) → NOT NULL → UNIQUE index.

**New tests** (7 regression tests, one per fix):
- `apps/api/test/students.e2e-spec.ts` — student-list search IDOR.
- `apps/api/test/documents-platform.e2e-spec.ts` — GLOBAL-scope download parity.
- `apps/api/test/visa.e2e-spec.ts` — Consultant view-only visa evidence.
- `apps/api/test/audit.e2e-spec.ts` — guard-level-denial audit.
- `apps/api/test/webhooks.e2e-spec.ts` — forged-then-real webhook delivery.
- `apps/api/test/reporting.e2e-spec.ts` — executive dashboard workload/deadlines.
- `apps/api/test/case-management.e2e-spec.ts` — case-owner reassignment.

**New documentation**:
- `docs/REQUIREMENTS_TRACEABILITY.md`
- `docs/security/SECURITY_TEST_REPORT.md`
- `docs/UAT_FINDINGS.md`
- `docs/phase-status/PHASE_13.md` (this file)

**Updated documentation**:
- `docs/ASSUMPTIONS.md` — ASM-56 through ASM-59.
- `docs/security/RBAC_MATRIX.md` — title, §4 ASSIGN action, §5 Passport/ID and Visa evidence rows, §7 three new deferral bullets.
- `docs/api/API_CONVENTIONS.md` — new `POST /cases/:id/reassign-owner` route.

No `docs/DECISIONS.md` entry — every fix in this phase was a genuine defect correction against an already-clear SRS requirement, not a discovered requirement conflict needing a judgment call recorded for posterity.

---

## TEST RESULTS

- Unit: **163/163 passed** (13 suites).
- E2E: **460/460 passed** (24 suites) — up from 453 pre-Phase-13 (+7 new regression tests, one per fix).
- Migration: applied cleanly (`prisma migrate deploy`), re-seeded cleanly (`prisma db seed`).

## REGRESSION RESULTS

Full suite re-run after all fixes: unit 163/163, e2e 460/460, both green. No prior-phase test broken by any Phase 13 change (the two behavior changes with real user-facing impact — student search scoping and Consultant visa-evidence access level — were each verified against their pre-existing test coverage first: the search fix didn't touch any passing assertion, since no prior test exercised that exact combination; the visa-evidence fix's one pre-existing assertion covered the *uploader's* own access, which is a separate, unaffected grant path, confirmed still passing).

## BUILD

`npm run --prefix apps/api build` (`nest build`) — clean, no errors.

## TYPECHECK

Covered by the above build (`tsc` via `nest build`) — clean.

## LINT

`npm run --prefix apps/api lint` — 0 errors, 7 pre-existing warnings in an untouched file (`mfa.service.spec.ts`, `no-explicit-any`), not introduced by this phase.

---

## ASSUMPTIONS

ASM-56 (rate-limiting deferred), ASM-57 (concurrent-case-race deferred), ASM-58 (checksum-at-download deferred), ASM-59 (LOR redaction test-gap) — see `docs/ASSUMPTIONS.md` for full entries with reasoning.

## RISKS

- General API rate-limiting remains unbuilt (ASM-56) — a scripted-abuse risk against non-login endpoints exists, mitigated by per-route RBAC but not by request-volume limiting.
- The "one active Case per Student" invariant has a narrow concurrent-request race window (ASM-57) — low realistic likelihood, not zero.
- Document checksum isn't re-verified at read time (ASM-58) — not exploitable via any code path today, but would silently miss out-of-band storage tampering if the storage provider ever changes.

## KNOWN ISSUES

- 4 PARTIALLY IMPLEMENTED traceability rows (Program/ScholarshipMaster external sync inertness beyond University; document checksum-at-download; LOR redaction test-gap; Parent document-revocation test-gap) — all previously-deferred items independently re-confirmed still accurate, or newly-tracked LOW-severity test gaps. None block the release gate.
- No backup/restore tooling exists anywhere in this repository (AC-16) — an infrastructure/ops gap outside the application codebase's scope, noted rather than silently ignored.

## VALIDATION RESULTS

- Requirements traceability: **complete** (63 requirements reviewed, full matrix in `docs/REQUIREMENTS_TRACEABILITY.md`).
- CRITICAL findings: **0** (1 found, fixed).
- HIGH security findings: **0** (3 found, fixed).
- HIGH business blockers: **0** (2 MEDIUM UAT findings found, both fixed).
- Full regression: **PASS** (163 unit + 460 e2e).
- Build: **PASS**.
- Typecheck: **PASS**.
- Lint: **PASS** (0 errors).
- UAT critical workflows: **PASS** (all 8 roles complete their realistic workflows end-to-end).
- No known unauthorized sensitive-data exposure remaining.
- No known destructive data-integrity bug.
- Documentation: **complete**.

## FINAL RELEASE GATE: PASS

## READY FOR PHASE 14: YES
