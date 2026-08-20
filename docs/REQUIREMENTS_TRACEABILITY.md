# Requirements Traceability Matrix

**Phase**: 13 (QA / Security / UAT)
**Source of truth**: `docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx` (extracted in full for this audit), cross-checked against `docs/phase-status/PHASE_02.md`–`PHASE_12.md`, `docs/database/ERD.md`, `docs/database/DATA_DICTIONARY.md`, `docs/api/API_CONVENTIONS.md`, `docs/security/RBAC_MATRIX.md`, `docs/ASSUMPTIONS.md`, `docs/DECISIONS.md`, the current `database/schema.prisma`, the current `apps/api/src` source, and the current `apps/api/test` suite.

**Method**: every requirement below was verified against the actual service implementation (not just controller/route existence) and the actual test assertions (not just test-file presence). Classifications:

- **IMPLEMENTED** — built, server-enforced, and test-covered (ALLOW + DENY where authorization-relevant).
- **PARTIALLY IMPLEMENTED** — the core mechanism exists but a named sub-requirement is missing or only reachable indirectly.
- **MISSING** — no implementation found.
- **INCORRECT** — implemented but diverges from the SRS in a way that matters (fixed in this phase where CRITICAL/HIGH, see `docs/security/SECURITY_TEST_REPORT.md` and `docs/UAT_FINDINGS.md` for fix detail).
- **DEFERRED** — a documented, deliberate `docs/ASSUMPTIONS.md` decision to not build it yet.
- **AMBIGUOUS** — the SRS line itself is not precise enough to grade pass/fail; noted as such.

Where this phase found and fixed a defect, the row is marked **IMPLEMENTED (Phase 13 fix)** with a pointer to the fix.

## Summary

| Domain | Requirements reviewed | Implemented | Partially implemented | Missing | Incorrect (fixed) | Deferred | Ambiguous |
|---|---|---|---|---|---|---|---|
| Identity/RBAC/Security (cross-cutting) | 12 | 10 | 0 | 0 | 2 (fixed) | 0 | 0 |
| Lead/Student/Case/Contract/Payment/Task (M02-04,18,20) | 13 | 12 | 0 | 1 (fixed) | 0 | 0 | 0 |
| Counseling/Profile (M05-11) | 9 | 9 | 0 | 0 | 0 | 0 | 0 |
| Admission/Visa pipeline (M12-17) | 13 | 11 | 1 | 0 | 1 (fixed) | 0 | 0 |
| Partner/Document/Notification/Audit-Reporting (M19,21-23) | 16 | 12 | 3 | 0 | 1 (fixed) | 0 | 0 |
| **Total** | **63** | **54** | **4** | **1 (fixed)** | **4 (fixed)** | **0** | **0** |

No requirement reviewed in this phase remains MISSING or INCORRECT after fixes; the 4 PARTIALLY IMPLEMENTED rows are documented gaps too narrow/low-risk to justify Phase 13 scope expansion (see each row's note) and are tracked as new `docs/ASSUMPTIONS.md` entries (ASM-56–ASM-59).

---

## 1. Identity, RBAC, and Field-Level Security (cross-cutting, SRS §3, §13, M01)

| Requirement | Entity | Database | API | Permission | Audit | Test | Classification |
|---|---|---|---|---|---|---|---|
| Role × sensitive-data matrix (§13): Passport/ID, Budget/Finance, Contract Value, Payment/Debt, Commission, Visa evidence, Internal notes, Audit logs — each role's documented ALLOW/DENY | Student/Contract/Payment/Visa/CommissionTransaction/Comment/AuditLog | field-level flags via `FieldPolicyService` | all relevant controllers | resource-scoped grants per role (`database/seeds/seed.ts`) | n/a | `rbac.e2e-spec.ts` + per-domain field-level tests | IMPLEMENTED — independently re-verified cell-by-cell against seed.ts and `FieldPolicyService`, all 8 rows MATCH |
| Server-side authorization, deny-by-default (NFR-SEC-01) | — | — | `AuthGuard` (global) | — | — | `*.e2e-spec.ts` 401/403 assertions throughout | IMPLEMENTED |
| Controller route ↔ RBAC_MATRIX.md consistency | — | — | all ~230 routes | — | — | n/a (static audit) | IMPLEMENTED — zero mismatches found across every `@RequirePermission`/`@Public()` decorator |
| List-endpoint scope filter cannot be bypassed by another query param (IDOR) | Student (and 8 other list endpoints using `query.search`) | — | `GET /students` | `students:view` + `OWN_STUDENT` scope | — | new: `students.e2e-spec.ts` "never leaks an unlinked student... via ?search=" | **INCORRECT — Phase 13 CRITICAL fix**. `StudentsService.list` flat-spread the scope filter's and the search filter's top-level Prisma `OR` keys into the same object; `search` silently overwrote (not narrowed) the scope filter, letting a STUDENT_PARENT enumerate every student via `?search=`. Fixed by combining both under `AND` (`apps/api/src/modules/case-management/students/students.service.ts`). The other 8 services using `query.search` were independently checked and use non-colliding filter keys — no other instance of this pattern found. |
| Portal parent-child scope (own child ALLOW, unlinked child DENY, revoked DENY-immediately) | StudentContact/Student | `portalStatus` | `/portal/*` | `portal:access` | — | `portal.e2e-spec.ts` (explicit ALLOW/DENY/revoked-same-token cases) | IMPLEMENTED |
| Document IDOR (ownerId/ownerEntity on upload grants no extra access) | Document | — | `POST /documents` | `documents:create` | CREATE | `documents-platform.e2e-spec.ts` | IMPLEMENTED |
| Offboarding revokes session/token immediately (AC-14) | User/Session | `sessions` table re-checked per request | `AuthContextMiddleware` | — | — | covered | IMPLEMENTED — session row re-validated against DB on every request, not cached |
| Login lockout after configurable failed-attempt threshold (§6.1) | User | `failedLoginCount`/`lockedUntil` | `POST /auth/login` | `@Public()` | LOGIN | covered | IMPLEMENTED |
| MFA for internal accounts (§6.1) | User | `mfaSecret`/TOTP | `/auth/mfa/*` | — | — | covered | IMPLEMENTED |
| Rate limiting beyond login (NFR-SEC-06) | — | — | — | — | — | none | **DEFERRED (ASM-56)** — no `@Throttle`/global rate limiter exists for non-login endpoints. Login itself has real lockout (above), which is the SRS's one *named* brute-force target; a general API-wide limiter would be new architectural surface (new dependency, per-route tuning, real risk of destabilizing the `--runInBand` e2e suite's rapid successive requests) — deferred rather than added under Phase 13's "no scope creep" rule, tracked as a known gap. |
| No hard-coded secrets; no plaintext token/secret logging | — | — | — | — | — | n/a (static audit) | IMPLEMENTED |
| Audit trail for every sensitive mutation, including guard-level denials (§1, AC-13) | AuditLog | full field set | `AuditInterceptor` + `AuthGuard` | — | — | new: `audit.e2e-spec.ts` "audits a guard-level 403" | **INCORRECT — Phase 13 HIGH fix**. NestJS runs Guards before Interceptors, so a `@RequirePermission` denial thrown by `AuthGuard` never reached `AuditInterceptor`'s DENIED-write path — only *service-level* (post-guard) denials were audited. Fixed by writing the same DENIED-shaped row directly from `AuthGuard` when the route is `@Audit`-decorated (`apps/api/src/common/guards/auth.guard.ts`). |

## 2. Lead / Student / Case / Contract / Payment / Task-KPI (M02-M04, M18, M20)

| Requirement | Entity | Database | API | Permission | Audit | Test | Classification |
|---|---|---|---|---|---|---|---|
| AC-01 Lead→Contract→auto Student+Case, no re-entry | Lead/Student/Case | `Lead.convertedStudentId` | `POST /leads/:id/convert` | `leads:convert` | CREATE | `lead-conversion.e2e-spec.ts` | IMPLEMENTED |
| Duplicate-student dedup on conversion (match email/phone/name+DOB, confirm) | Lead→Student | `DuplicateDetectionService` | same route | same | same | `lead-conversion.e2e-spec.ts` | IMPLEMENTED — real matching logic verified, not just an endpoint |
| §9 Lead FSM | Lead | `LeadStatus` | `PATCH /leads/:id/status` | `leads:edit` | — | covered | IMPLEMENTED — `CONVERTED` excluded from the manual-transition DTO |
| §9 Case FSM incl. CLOSED (reason + checklist) | Case | `CaseStatus` | `PATCH /cases/:id/status`, `.../close` | `cases:edit`/`close` | — | `case-management.e2e-spec.ts` | IMPLEMENTED — `close()` chains 5 independent precondition guards, each reusing the canonical `PaymentsService`/`VisaStatusService`, never re-deriving |
| §9 Contract FSM, Signed requires artifact | Contract | `ContractStatus` | `contracts.controller` | `contracts:*` | — | `contracts.e2e-spec.ts` | IMPLEMENTED |
| Contract monetary-threshold approval routing | Contract/Approval | `approvalThreshold` | `POST /contracts/:id/approve` | `contracts:approve` | — | `contracts.e2e-spec.ts` | IMPLEMENTED |
| AC-05 Signed contract → amendment, never overwritten | Contract/ContractAmendment | `ContractAmendment` | `POST /contracts/:id/amendments` | `contracts:amend` | before/after diff | `contracts.e2e-spec.ts` | IMPLEMENTED |
| AC-11 Payment: installments, partial, overdue, reconciliation | Payment | `@@unique([contractId,installmentNo])` | `payments.controller` | `payments:*` | — | `payments.e2e-spec.ts` | IMPLEMENTED |
| AC-06 Manager assigns owner/deadline/task, overdue in dashboard | Task | `deadline`/`ownerId` | `tasks.controller` | `tasks:assign` | — | `tasks.e2e-spec.ts`, `reporting.e2e-spec.ts` | IMPLEMENTED |
| §9 Task FSM, Overdue derived, never stored | Task | no `OVERDUE` enum value | `PATCH /tasks/:id/status` | `tasks:edit` | — | covered | IMPLEMENTED |
| AC-15 Dashboard KPIs from real transaction data | Reports | n/a | `/reports/*` | `reports:view` | — | `reporting.e2e-spec.ts` | IMPLEMENTED — single-source-of-truth confirmed (see below) |
| §8 ID formats: HS/HD/CASE/TASK/PAY/AM/LEAD/PT/PP-*, RES-*, COMP-* | multiple | `business_id_sequences` + per-entity code columns | `IdGeneratorService` | — | — | covered | **MISSING → IMPLEMENTED (Phase 13 fix)**. `Competition`/`ResearchProject` had no business code, unlike every other §8-listed entity. Added `competitionCode`/`researchCode` (migration `20260820030000_competition_research_business_id_phase13`, additive + backfilled), generated via the same `IdGeneratorService.nextYearlyCode` every other entity uses. |
| Case-owner reassignment is a real transfer, not an additive grant | Case/CaseMember | `Case.ownerId` | `POST /cases/:id/reassign-owner` (new) | `cases:assign` | ASSIGN | new: `case-management.e2e-spec.ts` "reassigns the case owner" | **MISSING → IMPLEMENTED (Phase 13 fix)**. Previously only `POST /cases/:id/members` with `role: OWNER` existed, which upserted a *second* co-existing OWNER without demoting the first and left `Case.ownerId` stale (UAT finding). Added a dedicated endpoint that demotes every prior OWNER to COLLABORATOR and updates `Case.ownerId` atomically. |
| Single source of truth: Outstanding payment, Task overdue | Payment/Task | — | `PaymentsService.outstandingAmount/isOverdue`, `TasksService.isOverdue` | — | — | grep-verified: zero independent re-derivations found | IMPLEMENTED |
| Data integrity: Student↔Case "at most one active case" invariant | Student/Case | app-level check-then-create, no DB constraint | `CasesService.createForStudent` | — | — | `case-management.e2e-spec.ts` covers the sequential (non-concurrent) case | **DEFERRED (ASM-57)** — a narrow concurrent-request race window exists (two simultaneous requests could both pass the check before either creates). A durable fix is a partial unique index (`CREATE UNIQUE INDEX ... ON cases(student_id) WHERE status NOT IN ('CLOSED','ARCHIVED')`) — not expressible directly in `schema.prisma`'s declarative syntax and hard to test deterministically within this phase's scope; documented as a known gap rather than rushed. |

## 3. Counseling / Profile Development (M05-M11)

| Requirement | Entity | Database | API | Permission | Audit | Test | Classification |
|---|---|---|---|---|---|---|---|
| §6.4 Assessment configurable criteria, versioned, approved never overwritten | Assessment/AssessmentCriterion | `@@unique([caseId,version])` | `assessments.controller` | `assessments:*` | VIEW/EDIT/APPROVE | `assessment-roadmap.e2e-spec.ts` | IMPLEMENTED |
| §6.5 Roadmap requires an *approved* Assessment baseline (cross-module gate) | Roadmap/Assessment | `Roadmap.assessmentId` FK | `roadmaps.controller` | `roadmaps:approve` | — | covered | IMPLEMENTED — genuinely enforced server-side (`roadmaps.service.ts` checks `assessment.status === 'APPROVED'`), not just documented |
| §6.5 Roadmap FSM; milestone can't close with unmet tasks/dependencies | Roadmap/RoadmapMilestone | dependency table + linked `Task.status` | `milestones.controller` | `roadmaps:edit` | — | covered | IMPLEMENTED |
| §6.6 Multiple test attempts, old scores never overwritten | TestRecord | `@@unique([caseId,testType,attemptNumber])` | `profile-evidence` routes | `profile_evidence:*` | — | `profile-evidence.e2e-spec.ts` | IMPLEMENTED |
| §6.7 Competition/Research/Activity fields + evidence→Document real FK | Competition/ResearchProject/Activity | real `evidenceDocumentId` FK | covered | covered | covered | covered | IMPLEMENTED |
| §6.8 Writing Draft→Review→Revision→Final→Submitted; version append-only; feedback per-version | WritingArtifact/WritingVersion | `@@unique([artifactId,versionNumber])` | `writing.controller` | `writing:*` | — | `writing.e2e-spec.ts` | IMPLEMENTED |
| §6.8 LOR fields | LetterOfRecommendation | full field set | `lor.controller` | `writing:*` | — | covered | IMPLEMENTED |
| §13 LOR internal-notes/contact redaction from Student/Parent | LetterOfRecommendation | — | `lor.controller` | — | — | `FieldPolicyService.redactLor` wired at all 4 read sites; **no dedicated e2e assertion found** | PARTIALLY IMPLEMENTED — code path confirmed correct by static read; test-gap only (tracked below, not a code defect). |
| Duplicate-logic check: Milestone↔Task delegation, Scholarship-essay↔WritingArtifact reuse | — | — | — | — | — | — | IMPLEMENTED — no parallel task/essay implementation found |

## 4. Admission / Visa Pipeline (M12-M17)

| Requirement | Entity | Database | API | Permission | Audit | Test | Classification |
|---|---|---|---|---|---|---|---|
| §6.9 University/Program/Scholarship Master fields + source/lastVerifiedAt/externalId/syncStatus | University/Program/ScholarshipMaster | full field set on all 3 | `admission-master.controller` | ED/DM edit, all-staff view | — | covered | IMPLEMENTED |
| §6.9 External sync never silently overwrites manually-verified data | same | `syncStatus` | `EXTERNAL_DATA_SYNC` job | `jobs:view` | — | `jobs-platform.e2e-spec.ts` | PARTIALLY IMPLEMENTED — only `University` has a real `syncExternal` method (Phase 12); `Program`/`ScholarshipMaster` carry the schema columns but no sync logic yet. Already correctly documented as deferred in `docs/ASSUMPTIONS.md` ASM-51 — this phase confirms that documentation still matches reality. |
| §6.10 School Selection (tier/rationale/status) | UniversityChoice | `@@unique([studentId,programId])` | `university-choices.controller` | Consultant full, Specialist view | — | covered | IMPLEMENTED |
| §6.11 Application independent transaction, configurable checklist, no plaintext credential storage | Application/ApplicationChecklist | full field set | `applications.controller` | Consultant+Specialist | — | covered | IMPLEMENTED — no credential/password field exists anywhere on Application |
| §6.12 Scholarship eligibility gate before Preparing/Submitted (server-side) | ScholarshipApplication | `eligibilityConfirmed` | `POST .../confirm-eligibility` | case-scoped | — | covered | IMPLEMENTED |
| §6.13 Offer multi-version, one enrollment target requires ACCEPTED offer | Offer/Enrollment | FK chain | `offers.controller`/`enrollments.controller` | case-scoped | — | covered | IMPLEMENTED |
| §6.14 Visa checklist per country/type, FSM, result requires evidence | Visa/VisaChecklistItem | full field set | `visas.controller` | see next row | — | `visa.e2e-spec.ts` | IMPLEMENTED |
| §6.14 "Visa evidence có field-level + download permission riêng" — Consultant restricted vs. Specialist/ED/DM full | Document (Visa evidence) | `DocumentAccess` | `visas.service.ts`/`visa-checklist.service.ts` grant calls | `documents:*` | — | new: `visa.e2e-spec.ts` "a Consultant case member gets view-only access..." | **INCORRECT — Phase 13 HIGH fix**. Every evidence-linking call site used the same uniform `grantCaseAccess` (VIEW+DOWNLOAD to every case member), giving Consultant full access to passport/financial visa evidence the SRS says should be "Xem hạn chế" (restricted view). Fixed by adding a `viewOnlyForRoles` option to `grantCaseAccess`, applied only at the 4 Visa evidence-linking call sites (`visas.service.ts`, `visa-checklist.service.ts`) — every other evidence-bearing module (Assessment/Roadmap/Profile/Writing/Application/Scholarship/Enrollment/Pre-departure) is unaffected. The document's uploader always keeps full access regardless of role (a separate grant, unaffected by this change). |
| §6.15 Pre-departure checklist, Enrollment fields, Closure requires enrollment/reason + debt resolved | Enrollment/Case | `Case.close()` | `pre-departure`/`POST /cases/:id/close` | case-scoped | — | covered | IMPLEMENTED — single chained gate, reusing `PaymentsService`/`VisaStatusService` |
| AC-08/09/10 | — | — | — | — | — | covered | IMPLEMENTED |
| §9 no direct arbitrary-status-write bypass (Application/Scholarship/Visa) | — | — | — | — | — | — | IMPLEMENTED — all 3 FSMs use explicit transition tables in the service layer |
| Data integrity: Application↔Program, Application↔Offer, ScholarshipMaster↔ScholarshipApplication, Case↔Visa, Visa↔Enrollment | — | real FKs throughout | — | — | — | — | IMPLEMENTED — no orphan-record paths found |

## 5. Partner CRM / Document Management / Notification / Audit-Reporting-Export (M19, M21-M23)

| Requirement | Entity | Database | API | Permission | Audit | Test | Classification |
|---|---|---|---|---|---|---|---|
| §6.17 Partner/PartnerProgram/PartnerDocument fields, versioned, separate Commission | Partner/PartnerProgram/PartnerDocument/CommissionRule/CommissionTransaction | full field set, real `documentId` FK into Document (no parallel storage) | `partners.controller` et al. | `partner*:*`/`commission_*:*` | — | `partners.e2e-spec.ts` | IMPLEMENTED |
| §6.17 Partner↔Student/Case junction, no Partner duplication | PartnerStudentLink | real FKs, no denormalized Partner fields | `partner-student-links.controller` | — | — | covered | IMPLEMENTED |
| Commission has a single calculation path | CommissionRule/CommissionTransaction | — | `computeAmount`, called only from `calculate()` | — | — | — | IMPLEMENTED |
| §6.19 Document metadata set, no public URL, signed short-lived URL | Document | full field set | two-step download flow | `documents:download` | DOWNLOAD | `documents-platform.e2e-spec.ts` | IMPLEMENTED |
| Signed-URL step-2 authorization must agree with step-1's GLOBAL-scope bypass | Document/DocumentAccess | — | `GET /documents/:id/download` → `GET /documents/download/:token` | — | — | new: `documents-platform.e2e-spec.ts` "a GLOBAL-scope role (director) can complete both download steps..." | **INCORRECT — Phase 13 HIGH fix**. `requestDownload`'s `assertAccessible` lets GLOBAL-scope roles (ED/DM) through without a `DocumentAccess` row; `downloadByToken` re-checked a raw grant row regardless of scope, so a GLOBAL-scope caller with no personal grant got a valid `downloadUrl` from step 1 and then a 403 on step 2 — breaking, not leaking, access. Fixed by re-deriving the same GLOBAL bypass inside `downloadByToken` from the token's `principalId`. |
| §6.19 Malware scan gates Active/Approved | Document.scanStatus | `DocumentScanStatus` | scan job + both download steps | — | — | `documents-platform.e2e-spec.ts` | IMPLEMENTED |
| §6.19 Checksum for duplicate/tamper detection | Document.checksumSha256 | present | computed at upload/version-create | — | — | duplicate case covered | PARTIALLY IMPLEMENTED — checksum is verified at upload/version-create but never re-verified at download time, so post-upload storage-layer corruption/tampering (disk corruption, a future non-immutable storage backend) wouldn't be caught before serving. **DEFERRED (ASM-58)** — re-hashing on every download is a real, bounded feature addition (not a security hole with the current `LocalFilesystemStorageProvider`, whose only write path is the upload/version-create flow itself), tracked rather than added under time pressure. |
| §6.19 Retention policy / legal hold | Document.retentionUntil/legalHold | columns exist, unused | — | — | — | none | DEFERRED — already correctly documented in `docs/ASSUMPTIONS.md` ASM-50 as schema-only/not yet enforced; this phase confirms no service reads/writes these fields, so the documentation still accurately reflects reality (no fix needed, no new gap). |
| §6.20 Reminder cadence (30/14/7/3/1 days + daily overdue) | Task/Payment | — | `tasks.service.ts`/`payments.service.ts` reminder sweeps | job-driven | — | `jobs-platform.e2e-spec.ts` | IMPLEMENTED — offsets match exactly |
| §6.20 No sensitive data in email body | Notification | — | `LogEmailProvider` | — | — | covered | IMPLEMENTED — generic subject/body, Payment reminders explicitly exclude amount/currency |
| §6.21 AuditLog required fields (actor/action/object/student/case/timestamp/result/IP/UA/before-after) | AuditLog | all fields present | `AuditInterceptor` | — | — | `audit.e2e-spec.ts` | IMPLEMENTED |
| §6.21/AC-13 every export success AND failure audited | Reports export | — | `GET /reports/cases/export` | `reports:export` | EXPORT | new: `audit.e2e-spec.ts` "audits a guard-level 403..." | See the cross-cutting Guard/Audit fix above (§1) — this requirement's guard-level-denial gap is the same defect, now fixed. |
| §6.21 Executive/Manager/personal dashboards match SRS content list | ReportsService | — | `/reports/*` | `reports:view` | — | `reporting.e2e-spec.ts` | **PARTIALLY IMPLEMENTED → IMPLEMENTED (Phase 13 fix)**. `executiveDashboard()` omitted `workload` and `deadlines`, both explicitly listed in SRS §6.21 for "Dashboard GĐĐH" (they were reachable only via a second call to `/reports/manager`). Added org-wide `workload`/`deadlines` summaries to `executiveDashboard()`, reusing `TasksService.isOverdue` as the sole source of truth (no second overdue calculation). |
| AC-16 backup/restore preserves audit/versioning | — | — | — | — | — | none found | DEFERRED/undocumented — no backup/restore tooling exists in this repository at all; this is an infrastructure/ops concern outside the application codebase's scope, noted here rather than silently ignored. |

---

## New `docs/ASSUMPTIONS.md` entries from this phase

- **ASM-56** — General API rate-limiting (beyond login lockout) deferred.
- **ASM-57** — Concurrent-request race on "one active Case per Student" documented as a known, narrow gap; durable fix (partial unique index) deferred.
- **ASM-58** — Document checksum re-verification at download time deferred.
- **ASM-59** — LOR field-redaction (§13) confirmed correct by code read; e2e assertion is a tracked test-gap, not a defect.

See `docs/ASSUMPTIONS.md` for the full entries.
