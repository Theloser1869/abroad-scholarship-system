# Client UAT Scenarios

## Methodology and honest limitation (read before the scenario results)

This audit attempted to set up an isolated local test environment to genuinely *execute* these scenarios end-to-end, per the task's own instruction ("If production lacks data: use isolated test environment"). Production was confirmed (in a prior operational-check phase of this project) to contain only a single `SYSTEM_ADMIN` bootstrap account with zero business data — no student, contract, or case exists in production, so none of these scenarios could ever be run there without fabricating production data, which is explicitly prohibited.

A local Docker Postgres + MinIO environment already exists in this workspace, and `database/seeds/seed.ts` contains a purpose-built RBAC/UAT fixture set (one demo user per role, including deliberately-scoped edge cases like a non-member Consultant and a revoked Parent link — clearly designed for exactly this kind of testing). This audit attempted to point a migration-status check at that local database via an inline `DATABASE_URL` override, **but the override was silently ignored and the command reached the production Supabase host instead** (confirmed by the printed datasource line). The command executed was read-only (`prisma migrate status`, no writes), so no harm occurred — but given that a "safe-looking" local override failed once, no further command (seed, migrate, app start) was risked, since any of those could mutate data if the same override failure recurred.

**Consequence:** every scenario below is marked **NOT_TESTED (live)**. The assessment given for each is an *inference from the static code evidence* gathered in `CLIENT_ACCEPTANCE_MATRIX.md` (real state-machine code, real permission checks, real scope filters — not just "the page exists"), which is a meaningfully stronger basis than a page/endpoint inventory alone, but it is explicitly **not** the same as watching the flow actually execute against real data. Per this audit's own rules, this is never upgraded to a live PASS.

**Recommended follow-up (outside this audit's scope):** fix the `.env`/local-environment setup (see `CLIENT_REQUIREMENTS_GAPS.md` — the `.env` currently points at production by default) and re-run these 9 scenarios live using the existing `demo.*` seed fixtures before final go-live sign-off.

---

## SCENARIO A — Lead → Contract → Student → Case
**Steps:** Create Lead → select service package → draft Contract → internal review → approve → send to client → sign → Student ID + Case created/linked.
**Code-inferred assessment:** Lead, Contract FSM (DRAFT→REVIEW→APPROVED→SENT→SIGNED), and `sign()`'s Case-linkage are all real, gated code (`contracts.service.ts`). **One structural caveat:** `sign()` requires an *already-existing* active Case for the student — it does not itself originate the Student/Case from a bare Lead (REQ-CASE-002). So the literal "Lead → Contract creates Student ID + Case" sequence the customer describes does not match the actual order of operations; Student/Case must exist first.
**Status:** NOT_TESTED (live). Code-inferred: PARTIAL — the FSM and linkage logic are real, but the sequencing differs from the customer's literal description (see REQ-CASE-002 / needs client confirmation).

## SCENARIO B — Case → Assessment → Roadmap → Profile
**Steps:** Create Assessment (baseline) → approve → create Roadmap referencing that assessment → approve Roadmap → confirm Profile Development tasks auto-generate.
**Code-inferred assessment:** Strong, specific evidence: `roadmaps.service.ts:70-98` — Roadmap approval is *hard-blocked* unless the referenced Assessment's status is literally APPROVED, and on success triggers real `TaskGenerationService` output (not a status-label no-op).
**Status:** NOT_TESTED (live). Code-inferred: IMPLEMENTED — this is the single best-evidenced workflow gate in the whole system.

## SCENARIO C — Case → University Choice → Application → Checklist → Offer
**Steps:** Add University Choice → create Application against it → track ApplicationChecklist items → record Offer.
**Code-inferred assessment:** All four entities are real, modeled, with dedicated frontend pages (`university-choices`, `applications`, `offers`). No cross-entity gating comparable to Scenario B was found (i.e., nothing blocks creating an Application before a University Choice exists) — this appears to be a looser, staff-driven sequence rather than a system-enforced one, which may be intentional.
**Status:** NOT_TESTED (live). Code-inferred: IMPLEMENTED (entities/pages), UNVERIFIED (whether staff can accidentally skip steps — not flagged as a defect since the customer sheet doesn't explicitly demand hard sequencing here).

## SCENARIO D — Application → Scholarship → Result
**Steps:** Link Application to a ScholarshipApplication → track through to a result/award status.
**Code-inferred assessment:** `ScholarshipApplicationStatus` real and tracked; REQ-CASE-010 already flags that the frontend has no distinct "Result" view (result is a status value within the scholarship-application record, not a separate outcome page).
**Status:** NOT_TESTED (live). Code-inferred: PARTIAL — backend complete, frontend result-reporting UX thinner than the customer's "Award Record" framing implies.

## SCENARIO E — Visa → Pre-departure → Enrollment
**Steps:** Create Visa case → complete VisaChecklistItems → progress through Pre-departure checklist → confirm Enrollment.
**Code-inferred assessment:** Visa and Enrollment are both fully modeled with dedicated pages. Pre-departure has a dedicated frontend page but this audit could not conclusively identify which backend entity actually backs it (REQ-CASE-012) — a genuine coverage gap in this audit pass, not a confirmed product defect.
**Status:** NOT_TESTED (live). Code-inferred: PARTIAL — Visa/Enrollment solid, Pre-departure's backend model needs a follow-up check before this scenario can be called fully verified even at the code level.

## SCENARIO F — Contract → Payment → Closure → Archive
**Steps:** Record Payments against an ACTIVE contract → move Contract through COMPLETED → LIQUIDATED → ARCHIVED.
**UPDATE (2026-08-25, Client Acceptance Remediation):** GAP-002 and GAP-007 are both remediated. SIGNED→ACTIVE now requires a received payment; ACTIVE→COMPLETED now requires no unresolved payment; COMPLETED→LIQUIDATED now requires a liquidation reason (persisted as `Contract.closureReason`); a dedicated Closure/Liquidation frontend page now exists (`/contracts/[id]/closure`). This scenario is now e2e-tested end-to-end via real HTTP requests against a real app + database (`contracts.e2e-spec.ts`'s "closure — payment-checked COMPLETED, reasoned LIQUIDATED" block: 7 tests, all passing) — a genuine step up from code-inference, though still not a live browser walkthrough.
**Status:** NOT_TESTED (live browser). **e2e-TESTED (API-level, 2026-08-25): PASS** — a staff member can now complete this scenario end-to-end through the product (previously could not).

## SCENARIO G — Partner → Partner Program → Student Link → Commission
**Steps:** Create Partner → add Partner Program → link a Student/Application to it → calculate and track Commission.
**Code-inferred assessment:** All entities real and wired to live endpoints, including the full CommissionTransaction lifecycle (create→confirm-eligibility→calculate→approve→pay). GAP-011 (Partner Program ID prefix bug) still lands on this scenario, untouched by remediation.
**UPDATE (2026-08-25, Client Acceptance Remediation):** GAP-006 partially remediated — `CommissionTransaction.contractId` and `PartnerStudentLink.contractId`/`scholarshipApplicationId` are now real, directly-queryable FKs (e2e-tested, `partners.e2e-spec.ts`, 5 new tests). Which Contract/Scholarship earned a given commission is now a direct join. Visa traceability remains a gap (deliberately deferred, not attempted this phase).
**Status:** NOT_TESTED (live browser). **e2e-TESTED (API-level, 2026-08-25): PASS for Contract/Scholarship traceability**, Visa traceability still MISSING. Partner Program ID prefix bug (GAP-011) unchanged.

## SCENARIO H — Student Portal: Roadmap → Task → Document → Application → Scholarship → Visa → Enrollment → Contract/Payment
**Steps:** Student logs into portal, views/interacts with each of these areas.
**Code-inferred assessment:** Every single requested capability was confirmed present with a real page backed by a real API call (`app/(portal)/portal/students/[id]/**` — roadmap, tasks, documents, applications, scholarships, visa, pre-departure, enrollment, contracts/payments, plus a bonus notifications tab). This is the most completely-covered scenario in the whole audit at the code level.
**Status:** NOT_TESTED (live). Code-inferred: IMPLEMENTED — strongest evidence of any scenario, but still genuinely unexecuted; a student's actual lived experience (does the roadmap render sensibly with real milestone data, do document uploads actually work end-to-end) was not watched happen.

## SCENARIO I — Parent Portal: linked child → allowed data → revoked relationship → denied access
**Steps:** Parent logs in, sees linked child(ren) via the student-switcher, then relationship is revoked and access should be denied.
**Code-inferred assessment:** `components/portal/student-switcher.tsx` confirms the linked-child switcher is real and pulls from a live API (`GET /portal/me`). The seed fixtures (`database/seeds/seed.ts:797-811`) deliberately include `demo.parent.linked`, `demo.parent.unlinked`, and **`demo.parent.revoked`** as three distinct test identities — strong circumstantial evidence that a revocation code path exists and was deliberately built to be testable, but this audit did not trace the actual revocation-enforcement code path (e.g. does `StudentContact` deletion/status-change immediately invalidate an already-issued session, the way `UsersService.offboard` does for staff — REQ-SEC-013's pattern is a good sign this project takes "immediate" revocation seriously, but Parent-specific enforcement was not independently traced in this audit pass).
**Status:** NOT_TESTED (live). Code-inferred: PARTIAL — linked-child access confirmed solid; revocation-enforcement specifically needs a dedicated follow-up trace (or a live test using the `demo.parent.revoked` fixture) before this can be called verified.

---

## Customer Role UAT (per-role login → dashboard → allowed/denied modules → field visibility → export → download → audit)

All 8 roles (7 customer + SYSTEM_ADMIN) have a purpose-built demo fixture in `database/seeds/seed.ts` (`demo.director`, `demo.manager`, `demo.consultant.a`/`demo.consultant.b`, `demo.docspecialist`, `demo.sales`/`demo.sales.b`, `demo.finance`, `demo.student.self`, `demo.parent.linked`/`demo.parent.unlinked`/`demo.parent.revoked`) — deliberately including both a case-member and a non-member Consultant, and both an owning and a non-owning Sales/Marketing user, specifically to exercise scope boundaries. **None of these were exercised live in this audit** for the same environment-safety reason given above.

Code-inferred assessment per role, based on the RBAC/scope evidence in `CLIENT_ACCEPTANCE_MATRIX.md`'s REQ-RBAC block:

| Role | Dashboard | Allowed modules | Denied modules | Field visibility | Export/Download | Audit |
|---|---|---|---|---|---|---|
| EXECUTIVE_DIRECTOR | Executive tab (real, org-wide) | All (GLOBAL scope) | None by design | Full (no redaction) | Allowed, **not row-capped** (GAP-001) | VIEW/DOWNLOAD/EXPORT all logged |
| DEPARTMENT_MANAGER | Manager tab (per-owner workload) | Most, Payment restricted to view/export | Payment create/record/refund/waive | Full | Allowed, not row-capped | Same as above |
| CONSULTANT | Individual (`/reports/me`) | Case-scoped Student/Roadmap/Writing/etc (CASE_MEMBER) | Contract/Payment/Marketing; **zero** Partner Documents (GAP-008) | Financial fields redacted (Contract.value/Payment.amount) | Export not typically granted on business modules | VIEW logged |
| DOCUMENT_SPECIALIST | Individual | Application/Scholarship/Visa/Document (CASE_MEMBER) | Marketing, most Contract/Payment | Financial + budget redacted | — | VIEW logged |
| SALES_MARKETING | Individual | Lead/Marketing only | Contract/Payment/Document/Visa/Student detail — confirmed zero grants | Budget + financial redacted | — | VIEW logged |
| ADMIN_FINANCE | Individual | Contract/Payment/Partner Documents(view-only, GAP-009) | Roadmap/Writing/NCKH/etc; **zero Visa** (GAP-009) | Full financial visibility (their job) | Payment export allowed | VIEW/EXPORT logged |
| STUDENT_PARENT (student) | Portal Overview | Own data only (OWN_STUDENT scope) | All other students, all internal tooling | Internal notes redacted across several entities | Not applicable to this role | — |
| STUDENT_PARENT (parent) | Portal, linked-child switcher | Linked child(ren)'s data only | Unlinked/revoked children (needs live confirmation — Scenario I) | Same redaction as student | Not applicable | — |
| SYSTEM_ADMIN | None (no `reports:view`-equivalent seen for this role in the dashboard code) | Users/Audit Logs/Jobs administration only | **All business data** (zero grants, by design) | N/A — never sees business records | — | Its own reads are audited too (`audit-logs.controller.ts:19`) |

**Status for the whole Role UAT section:** NOT_TESTED (live). Code-inferred confidence is HIGH for the permission *boundaries* (extensively cross-checked against the actual seed grants in the RBAC research pass) but LOW for the *lived experience* (does each dashboard actually render correctly for each role, do denied-module pages show the right Vietnamese "Không có quyền truy cập" message in practice) — the frontend evidence pass did confirm the `require-permission.tsx` component exists and is wired to real pages, which is reassuring circumstantial support, but again: not watched happen.
