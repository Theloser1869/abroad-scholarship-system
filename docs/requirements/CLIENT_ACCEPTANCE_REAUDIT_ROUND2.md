# Client Acceptance Re-Audit — Round 2

**POST-ROUND-2 CORRECTION (2026-08-25) — read before trusting this document's `Student.school`/GAP-022 narrative:** This round's own §D "Student Mandatory-Field Enforcement" finding and its §23-24 tally both state that `Student.school` ("Trường/Lớp") was "genuinely absent," "never implemented at all," and treat it as a new HIGH finding (GAP-022/REQ-STUDENT-007). **That was an audit error made by this round, not a code defect.** A follow-up check (2026-08-25, prompted by a client-sheet re-verification of sheet04) found that `AcademicRecord.school String` is NOT NULL and required at both the DTO layer (`create-academic-record.dto.ts`) and the UI form layer (`academic-record-dialog.tsx`) — this round's search only checked `model Student` in `database/schema.prisma` and never checked `model AcademicRecord`, the same model where the `grade`/`gpa` fields this round DID credit also live. Per this project's "never silently rewrite history" convention, the §D and §23-24 sections below are left **exactly as originally written** — they are an accurate historical record of what this round concluded at the time, not of present ground truth. For the corrected, current status, see `CLIENT_ACCEPTANCE_MATRIX.md`'s "POST-ROUND-2 CORRECTION (2026-08-25)" section (full evidence), the corrected `GAP-022` entry in `CLIENT_REQUIREMENTS_GAPS.md` (now RESOLVED), and `CLIENT_ACCEPTANCE_REPORT.md`'s "Post-Round-2 correction" notes. No code changed as part of this correction. A genuinely new, minor, non-mandatory finding also surfaced during that same follow-up check: GAP-026 (`Activity` model has no `award` field) — not related to this round's own work, tracked separately.

**CLIENT DECISIONS APPLIED (2026-08-25) — a second correction, on top of the one above:** This round's §D finding also treats the stage-timing of Student mandatory-field enforcement (Assessment-approval time vs. Student-creation time) as an unconfirmed interpretation, and separately reports GAP-004/GAP-005 as merely PARTIALLY REMEDIATED for that reason. The client has since directly confirmed (2026-08-25) that Assessment-approval-time gating is the intended design — this closes that open question, and **GAP-004/GAP-005 are now RESOLVED**, not partial (see `CLIENT_REQUIREMENTS_GAPS.md`). The client separately resolved CONFLICT-004 (`Student.gpa` required-vs-optional, also first surfaced by this round) as **Optional** — which exposed a new, previously-unflagged finding, **GAP-027**: `assertStudentProfileComplete` still requires GPA, not yet updated to match the client's decision. Net effect on this round's own tallies: **HIGH remaining is now 2** (GAP-006, GAP-007), not the 4 this round originally reported or the 3 the first correction above landed on. This paragraph's own §D/§23-24 references are left as originally written, per this document's own historical-record convention.

**CODE FIXES APPLIED (2026-08-25) — a third, final update:** The client then asked for GAP-027 and GAP-026 to be fixed in code (not just recorded). Both are done: `assertStudentProfileComplete` no longer requires `gpa` (only `grade`); `Activity.award` was added (migration `20260825084819_activity_award_field`). A full re-check of every sheet04 field against current code, requested by the client as part of the same conversation, found no further Student Profile gaps beyond these two, now-resolved findings. See `CLIENT_ACCEPTANCE_MATRIX.md`'s "CODE FIXES APPLIED (2026-08-25)" section and `CLIENT_REQUIREMENTS_GAPS.md`'s GAP-026/GAP-027 entries (both RESOLVED) for full detail, including the test suites re-run to confirm (20/20, 17/17, 5/5, all passing).

**CLOSURE/LIQUIDATION REMEDIATION APPLIED (2026-08-26) — a fourth update, resolving this round's §E finding:** This round's §E "Closure/Liquidation" section (and its §16/§18/§23-24 references) found two independent, unsynchronized closure mechanisms — the Contract-level path (debt-check only, reachable by HCTH) and the Case-level path (thorough, but unreachable by HCTH) — with document handover checked by neither and liquidation's "xác nhận hai bên" left as unenforced free text, gated on client decisions DEC-06/07/08. **The client has since answered all three** (this conversation, 2026-08-26): unify into one workflow with HCTH as standard executor and an audited ED/DM exception (DEC-06); all 6 preconditions including a real document-handover check, never auto-inferred (DEC-07); a structured, immutable two-party liquidation confirmation (DEC-08). Implemented in full — see `docs/requirements/CLOSURE_LIQUIDATION_DESIGN.md` and `docs/DECISIONS.md` DEC-13. **GAP-007 is now RESOLVED; HIGH remaining drops from 2 to 1** (GAP-006 only). Per this project's "never silently rewrite history" convention, §E and its §16/§18/§23-24 references below are left **exactly as originally written** — an accurate historical record of what this round found at the time, not of present ground truth.

---

**Trigger:** Post-remediation re-audit, requested immediately after `CLIENT_ACCEPTANCE_REMEDIATION_REPORT.md` (2026-08-25) reported all 6 named blockers fixed and declared `PASS WITH CONDITIONS`. This round exists specifically to check that self-assessment, not to re-run it.

**Governing rule for this round:** Remediation PASS, frontend/backend tests passing, and the prior phase's own "PASS WITH CONDITIONS" verdict are **not** treated as default evidence that a customer requirement is actually met. Every blocker's status was re-derived from the Excel wording and current code, independently of what the remediation report claimed about itself.

**Source of truth (unchanged):** `docs/He_thong_quan_ly_du_hoc_hoc_bong.xlsx`, all 21 sheets, dumped in full at the start of the original audit and read again this round (on-disk timestamp 2026-08-18, predates every phase of this work — never modified).

**Method note:** This round used 4 parallel sub-agents ("forks") to independently re-derive findings across disjoint scopes — blockers/conflicts, RBAC/security, case-workflow/journeys, data-model/ID-format — each re-reading the Excel and current code fresh rather than trusting the remediation report. One sub-agent (data-model/ID-format) exceeded its assigned scope mid-run: it started its own parallel e2e regression (colliding with the coordinator's own in-flight regression run and corrupting both) and edited the live matrix/gap docs directly instead of writing to its designated scratchpad file, before that could be corrected. Its actual analytical content was cross-checked against the independent blocker fork's findings (which reached the same conclusions on `Student.school` and Visa-traceability severity via a completely separate path) and found accurate — it is retained — but the process violation is disclosed here rather than silently absorbed. A subsequent session interruption also lost two of the four forks' in-progress work entirely (no partial output survived); both were relaunched from scratch with explicit scope guardrails and completed cleanly the second time. The coordinator performed its own direct follow-up investigation on two items the case-workflow fork flagged as needing verification beyond its scope (`Case.close()`'s actual precondition logic, and the Parent Portal's linked-child mechanism) before finalizing this report.

---

## §0 — Environment Safety

**PASS.**

- `.env` `DATABASE_URL`/`DIRECT_URL` → `postgresql://abroad_app:***@localhost:55432/abroad_scholarship_dev` (local Docker Postgres, container `abroad-scholarship-postgres`) — re-confirmed multiple times across this round, including after an unplanned session/container restart mid-round, never reverted to production.
- `STORAGE_PROVIDER=local` (confirmed, not `r2`).
- No `.env.local` or `.env.test` override files exist.
- No migrate/seed/reset command was run this round — only read-only code inspection, backend unit tests (no DB dependency), frontend tests/typecheck/lint/build (no DB dependency), and e2e suites pointed at the confirmed-local database.
- Process hygiene: node.exe process count was driven up to ~74 mid-round by the scope-violating fork's unauthorized parallel test run (see Method note above); corrected before the final authoritative regression pass by confirming a clean 0-1 process baseline before each DB-touching command.

No production credential, connection string, or secret is reproduced anywhere in this report.

---

## §1-3 — Re-Audit Scope Disclosure

**Received full, independent, fresh re-derivation from Excel + current code this round** (not carried forward from the remediation report's self-assessment):
- All 6 remediated blockers (Export Control, Payment-Gated Activation, Task.output, Student Mandatory Fields, Closure/Liquidation, Commission Traceability) — §6-13 below.
- The 3 pre-existing formal CONFLICT items, plus one newly-discovered internal contradiction in the customer's own Excel (CONFLICT-004).
- The full 8-role × 22-module RBAC/permission matrix (sheets 02/03), cross-checked against `database/seeds/seed.ts` read in full.
- The 16-stage case lifecycle (sheet08) and all 9 customer journey scenarios, traced end-to-end against current code.
- The Data Dictionary (sheet17), ID-format rules (sheets 18/20), and Contract/Partner sections (sheets 11-16).
- `database/schema.prisma`'s full `Student` model and the 3 new remediation migrations, read in full.
- Two follow-up items the case-workflow fork flagged as outside its scope, resolved directly by the coordinator: `Case.close()`'s actual precondition logic (`cases.service.ts:181-230`), and the Parent Portal's linked-child mechanism (`portal-access.service.ts:160-165`).

No requirement was skipped because it had previously been marked IMPLEMENTED; every section above was re-read from the current code state, not assumed unchanged.

---

## §4 — Requirement Inventory

**Total: 130** (127 original + 3 new rows found this round: `REQ-STUDENT-007` school field, `REQ-RBAC-013` HCTH/ADMIN_FINANCE Student-Profile access, `REQ-CASE-016` unified case-stage tracking). Full inventory with Requirement ID / source sheet / exact text / mandatory flag / evidence lives in `docs/requirements/CLIENT_ACCEPTANCE_MATRIX.md` (its "ROUND 2 RE-AUDIT CHANGELOG" table at the top lists every row whose status or evidence changed, and why; a new "Customer Journey Scenarios" section covers the 9 end-to-end scenarios separately from the requirement count, consistent with the original audit's own methodology).

No requirement was dropped or skipped because it had previously been marked IMPLEMENTED.

---

## §5 — Status Definitions

Used exactly as specified: IMPLEMENTED / PARTIAL / MISSING / INCORRECT / NOT_TESTABLE / CONFLICT / NOT_APPLICABLE. No row in this round was marked IMPLEMENTED solely because "the endpoint exists" — every IMPLEMENTED verdict cites the specific enforcement mechanism and, where relevant, the test that proves it.

---

## §6-13 — Blocker-by-Blocker Re-Verification

### A. Export Control — **IMPLEMENTED (RESOLVED)**

**Customer requirement (exact):** sheet07 row6 "Không cho export hàng loạt" (bulk export forbidden); sheet09 row8 "Hạn chế export hàng loạt | Bắt buộc"; sheet20 row10 "Export phải theo quyền và được log ... Export toàn bộ dữ liệu tự do [forbidden]." **No numeric cap is specified anywhere in the Excel.**

**Implementation:** `apps/api/src/common/export/export-row-cap.ts` — `EXPORT_ROW_CAP=5000`, every export query fetches `take: EXPORT_ROW_CAP+1` and throws 409 `EXPORT_ROW_LIMIT_EXCEEDED` on overflow (never silent truncation). Exactly 4 export endpoints exist repo-wide (students/contracts/payments/reports.exportCases), all permission-gated, `@Audit('EXPORT')`-decorated, and all pass rows through `FieldPolicyService.redact*()` before returning — export does not bypass field redaction.

**Test evidence:** e2e coverage for reason-required/role-denied/within-cap-and-audited; the over-cap path is unit-test-only (`export-row-cap.spec.ts`) by deliberate, documented design — a live over-cap e2e test was found to pollute a concurrently-running suite and was reverted.

**Round 2 finding (cosmetic, LOW):** `export-row-cap.ts:7`'s code comment cites "ASM-70" — wrong reference; the real entry is ASM-87. Zero functional impact.

**Verdict:** Mandatory requirement satisfied — permission-gated, logged, capped, no free bulk export, no redaction bypass. The 5000 number remains a disclosed engineering decision (ASM-87), not a customer-confirmed number.

---

### B. Payment-Gated Contract Activation — **IMPLEMENTED (RESOLVED)**, threshold still CONFLICT-001

**Customer requirement (exact):** sheet11 row9-10 places a PAYMENT stage between SIGNED and ACTIVE, naming the ACTIVE-transition actor as "Hệ thống" (System) / "Tự động." **No amount/percentage/deposit threshold is ever stated.**

**Implementation:** `contracts.service.ts` `updateStatus()` (lines 250-348) — SIGNED→ACTIVE requires at least one Payment PARTIALLY_PAID/PAID, else 409 `PAYMENT_REQUIRED_FOR_ACTIVATION`. Runs inside `prisma.$transaction`; the write is a compare-and-swap `updateMany({where:{id, status: contract.status}})` — genuinely race-safe, confirmed by reading the dedicated concurrent-activation e2e test line-by-line (asserts exactly one 200 + one 409/`count===0`, not merely "some error happened").

**Round 2 observation (LOW, not a downgrade):** the Excel names the actor as automatic/System; the implementation requires an explicit staff `PATCH` call. The *gate* is sound either way — receiving a payment doesn't itself trigger activation, which is arguably safer, not a defect.

**Verdict:** Mandatory precondition genuinely enforced, race-safe. **CONFLICT-001 correctly remains open** — no customer-specified threshold exists anywhere in the Excel; "any amount received" is a disclosed engineering choice (ASM-88), not a confirmed client decision. No sign-off document found anywhere in `docs/`.

---

### C. Task.output Enforcement — **IMPLEMENTED (RESOLVED)**

**Customer requirement (exact):** sheet00 row9 "Mọi công việc phải có Owner + Deadline + Output + Status" (unconditional, no stage qualifier); sheet17 row61 marks `Task.output` "Required" in the same column as the other three fields.

**Implementation:** `tasks.service.ts` `applyStatusTransition()` (lines 211-271) — the DONE transition requires non-empty `output`, 409 `OUTPUT_REQUIRED` otherwise, mirroring the pre-existing BLOCKED/`blocker` precondition.

**Bypass check:** every code path that can set `Task.status='DONE'` — staff `updateStatus()` and portal `portalUpdateStatus()` — funnels through the same gate. No parallel/looser FSM found.

**Judgment call:** the Excel never literally says "at creation," and a task cannot have real output before work is done — enforcing at DONE is the only logically coherent reading of an inherently sequential requirement, disclosed as ASM-89 rather than silently assumed. This is the one blocker where Round 2 explicitly declines to downgrade despite the Excel's lack of an explicit stage qualifier, because unlike the Student-fields case there is no implementable alternative reading.

**Verdict:** Mandatory requirement met, no bypass found, assumption properly disclosed.

---

### D. Student Mandatory-Field Enforcement — **PARTIAL** (downgraded from Round 1's "IMPLEMENTED (Remediated)")

**Customer requirement (exact):** sheet04 rows 3-6, 15-18 mark Họ tên/Ngày sinh/**Trường-Lớp**/GPA/Mục tiêu quốc gia/Ngành mục tiêu/Intake/Mục tiêu học bổng all "Bắt buộc," no stage specified.

**Implementation:** `assessments.service.ts` `assertStudentProfileComplete()` (lines 138-161), called from `approve()` before Assessment can move REVIEW→APPROVED — checks `dateOfBirth`, `targetCountry`, `targetMajor`, `targetIntake`, `scholarshipGoal` all non-null, plus at least one `AcademicRecord` with both `grade` and `gpa` set; 409 `STUDENT_PROFILE_INCOMPLETE` with named missing fields otherwise. No bypass path found — Roadmap approval re-checks `assessment.status === 'APPROVED'`.

**New finding, not previously caught:** sheet04 row5 marks "Trường/Lớp" (School/Class) "Bắt buộc." `database/schema.prisma` `model Student` has **no `school` column at all** — not deferred-enforcement like DOB/GPA, genuinely absent from the data model, not touched by GAP-004's remediation. Registered as new row **REQ-STUDENT-007** / new finding **GAP-022**.

**Internal customer-source conflict found this round:** sheet04 row6 marks GPA "Bắt buộc"; sheet17 row7 marks the same `gpa` field "Optional." The implementation follows the stricter sheet04 reading. Registered as **CONFLICT-004** — not resolved by this codebase either way.

**Verdict:** 7 of 8 named fields are solidly stage-enforced (a defensible interpretation of an Excel with no stage qualifier, disclosed as ASM-90). But `school`, an explicitly mandatory field, has zero implementation. PARTIAL is the honest classification.

---

### E. Closure/Liquidation — **PARTIAL** (downgraded from Round 1's "IMPLEMENTED (Remediated)"; refined a second time mid-round after a deeper discovery)

**Customer requirement (exact):** sheet11 row12 "Hoàn tất | Kiểm tra nghĩa vụ | **Dịch vụ hoàn thành, công nợ, tài liệu bàn giao** | HCTH/Quản lý | Closure Checklist | COMPLETED" — three distinct obligations, HCTH named as (one of two) actors. Row13 "Thanh lý | Tạo biên bản thanh lý | **Ngày thanh lý, xác nhận hai bên** | HCTH | Liquidation Record | LIQUIDATED" — date plus two-party confirmation.

**First-pass finding:** the new `apps/web/app/(staff)/contracts/[id]/closure/page.tsx` is real and reachable via a link from the Contract detail page, gated to `contracts:edit` (ADMIN_FINANCE holds this), `@Audit('EDIT')`-covered. `contracts.service.ts:298-316` — ACTIVE→COMPLETED checks only outstanding Payments ("công nợ"); nothing checks service completion or document handover. COMPLETED→LIQUIDATED requires only free-text `closureReason` — captures the date (`liquidatedAt`) but not a real two-party confirmation.

**Second-pass discovery (coordinator follow-up, prompted by a flag from the case-workflow fork):** a **second, independent closure mechanism exists** — `Case.close()` (`cases.service.ts:181-230`), gated to `cases:close` (held by EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT — **not** ADMIN_FINANCE). Read in full: it rejects closure if any open Task remains (`OPEN_TASKS_REMAIN`), if outstanding debt remains (`OUTSTANDING_DEBT_REMAINS`), if any Visa is not yet Granted/Refused/Withdrawn (`VISA_IN_PROGRESS`), if an in-progress Application has no confirmed Enrollment (`ENROLLMENT_NOT_CONFIRMED`), or if required pre-departure checklist items aren't Done/Waived (`PRE_DEPARTURE_CHECKLIST_INCOMPLETE`). This substantially covers "dịch vụ hoàn thành." Real UI at `/cases/[id]` with a working close dialog, `@Audit('ARCHIVE')`-covered.

**The precise picture, not "2 of 3 missing":** service completion IS checked in the product — just via a role (Case-owning: ED/DM/Consultant) that the Excel does not name for this specific closure stage, while HCTH — the role the Excel does name — can only reach the weaker Contract-level path (debt only). **Document handover ("tài liệu bàn giao") is checked by neither mechanism** — a clean, unambiguous gap. The two closure states (`Case.status`, `Contract.status`) are not synchronized with each other. Liquidation's "xác nhận hai bên" remains unenforced free text in the one path that has a liquidation concept at all (`Case.close()` has none).

**Verdict:** More real coverage exists than the first pass credited, but it's split across two mechanisms neither of which is complete, and the more thorough one is unreachable by the Excel's designated actor. PARTIAL, with a role-routing problem as the central issue alongside the genuine document-handover gap.

---

### F. Commission ↔ Contract Traceability (incl. Visa) — **PARTIAL**, HIGH severity confirmed, not softened

**Customer requirement (exact):** sheet16 header row: "Student ID | Contract ID | Partner ID | Trường/Đơn vị | Vai trò đối tác | Chương trình | Application | Scholarship | **Visa** | Trạng thái." Visa is a co-equal column with Application/Scholarship, no optional/lower-priority marker anywhere in sheet13/14/15/16.

**Implementation:** `CommissionTransaction.contractId` and `PartnerStudentLink.contractId`/`.scholarshipApplicationId` are real, indexed FKs (migration `20260824161414...`). `resolveSource()` auto-resolves `contractId` (direct for Contract-sourced, one hop via `Payment.contractId` for Payment-sourced). **No `visaId` field exists on either model.** No endpoint, service method, or documented mechanism joins a CommissionTransaction to a Visa today.

**Determination on mandatoriness:** no field in sheet16 (or anywhere else) distinguishes Visa as lower-priority than Application/Scholarship. The most defensible reading treats it as in-scope of the same mandatory requirement as the two legs that were fixed.

**Verdict:** Contract and Scholarship legs are solid, real, tested fixes. The Visa leg is structurally absent. HIGH severity — same tier as the original GAP-006, not softened to a minor footnote at the acceptance-decision level.

---

### G. Four Customer Conflicts (`docs/requirements/CLIENT_REQUIREMENT_CONFLICTS.md`)

- **CONFLICT-001** (payment threshold): Excel confirmed to specify none. GAP-002's functional fix stands regardless. **Still fully open** — no client sign-off found anywhere in `docs/`.
- **CONFLICT-002** (SYSTEM_ADMIN not in the customer's 7-role list): sheet02 confirmed to list exactly 7 roles. **Still open**, LOW impact, documentation/sign-off gap only.
- **CONFLICT-003** (Partner access "chỉ xem dữ liệu chia sẻ theo case," ambiguous): sheet09 row18 wording confirmed. **Still open**, genuinely ambiguous, no client interpretation obtained.
- **CONFLICT-004 (new this round)** — sheet04 vs. sheet17 disagree on whether `Student.gpa` is required. Not an implementation defect; the customer's own two source sheets disagree with each other. **Open**, LOW impact (the implementation follows the stricter reading, a safe default), documentation-correction item.

No client interaction occurred during or after remediation — correctly, none of the 4 conflicts were resolved by assumption.

---

## §14 — Data Dictionary Re-Audit

Re-checked `database/schema.prisma` against sheet17 for the 3 new remediation migrations plus previously-flagged rows. **The 5 fields the remediation claimed to add are all genuinely present and correctly wired**: `Student.scholarshipGoal`, `AcademicRecord.grade`, `Contract.closureReason`, `CommissionTransaction.contractId`, `PartnerStudentLink.contractId`/`.scholarshipApplicationId` — all real columns, all reachable through their respective DTOs and forms, confirmed via direct schema read. Previously-flagged gaps confirmed unchanged: Contract missing `contract_type`/`start_date`/`end_date`; Partner missing `country_name`, `partner_type` enum mismatch; Application/Scholarship missing `partnerProgramId`; Document missing a direct `studentId` FK. New: `REQ-DATA-013` (the sheet04/sheet17 GPA contradiction) added as its own row, tracked as CONFLICT-004.

## §15 — ID Format Re-Audit

Re-verified against the ID generator and its call sites. **Unchanged:** Partner Program generates `PT-CC-NNNNN-NN` instead of the documented `PP-CC-NNNNN-NN` (a real bug — `nextPartnerProgramSuffix` naively concatenates the parent's own PT-prefixed code); Training (TRN) has no model/service/call-site anywhere in the backend (confirmed via a fresh repo-wide grep). All other 12 prefixes (HS/HD/PT/APP/SCH/VISA/TASK/DOC/RES/COMP/PAY/AM) confirmed correctly generated, unique (`@unique` in schema), and immutable (no update DTO accepts a code override).

## §16 — Case Workflow Re-Audit

Full 16-stage lifecycle table rebuilt (Entity/API/Frontend/Permission/Transition/Audit/Output for every stage) — see `CLIENT_ACCEPTANCE_MATRIX.md`'s REQ-CASE-* rows for the per-stage detail. Two findings beyond the individual stages:

1. **`Case.stage` is unvalidated free text** (`cases.service.ts:128,143`), with no derivation from the ~10 real, independently-gated sub-entity statuses. Each individual stage's own gate is genuinely enforced (Assessment→Roadmap, Contract FSM, etc.) — this is about the summary label potentially drifting from what the data actually shows, not about any stage being unenforced. New row `REQ-CASE-016`, MEDIUM severity, new finding `GAP-024`.
2. **Two independent Closure mechanisms** — see §E above. `REQ-CASE-012` (Pre-departure)'s previously-open question is now conclusively resolved: it reuses the `VisaChecklistItem` model with `entityType:'PreDeparture'`, a deliberate documented reuse pattern, not a missing entity. Upgraded PARTIAL→IMPLEMENTED.

## §17 — Role Conformance Re-Audit

Full 8-role × 22-module permission matrix rebuilt independently from sheet02/03 and cross-checked against `database/seeds/seed.ts` read in full for every role block. Confirmed accurate and unchanged: REQ-RBAC-002 (SYSTEM_ADMIN, CONFLICT), REQ-RBAC-006/007/012 (Consultant/HCTH/Sales under-provisioned vs. "Hạn chế" cells), REQ-RBAC-011 (Partner `getById` no per-record scope check). Independently re-confirmed REQ-RBAC-013 (HCTH zero Student Profile grant, the 4th instance of the same pattern).

**New finding — root cause, not a new symptom:** `TestRecord`/`Competition`/`ResearchProject`/`Activity` are all gated by one shared `profile_evidence` RBAC resource. Sheet03 gives Sale/Marketing a *different* grant per module (Competition="Hạn chế" vs. Luyện thi/NCKH="Không") — a distinction the current permission model cannot express even if the missing grant were added. Fixing REQ-RBAC-012 properly requires splitting `profile_evidence` into per-module resources, not a one-line seed change. New finding `GAP-025`.

**Confirmed clean (no regression from remediation):** the new `scholarshipGoal`/`closureReason` fields pass through `FieldPolicyService` unredacted correctly (nothing in the Excel flags them sensitive); the new `contractId` Case-list filter is an additive AND on top of the existing scope filter, no cross-scope leak; `field-policy.service.spec.ts`'s remediation-era fixture patches are compile-time shape fixes only, the actual `expect()` assertions are untouched.

## §18 — Customer Journey Re-Audit

All 9 scenarios re-traced end-to-end against current code — full table in `CLIENT_ACCEPTANCE_MATRIX.md`'s new "Customer Journey Scenarios" section. Headline changes from Round 1: **Journey E (Visa→Pre-departure→Enrollment) upgraded to IMPLEMENTED** (Pre-departure model resolved); **Journey F (Contract→Payment→Closure→Archive) downgraded to PARTIAL** (Round 1 had reported this IMPLEMENTED immediately after remediation — the closure gaps found in §E apply here too); **Journey I (Parent Portal) confirmed IMPLEMENTED** — Round 1 had asserted "linked-child" coverage without ever opening the code; this round traced `GET /portal/me` directly and confirmed genuine server-side resolution of every linked student via the real `StudentContact` table (`portal-access.service.ts:160-165`), with a real multi-child picker UI, not a client-side guess.

## §19 — Live UAT

Not performed this round — no safely-testable local UI-driving environment was set up (browser-driven live UAT was out of scope for this pass; code-level and API-level re-verification only, consistent with Round 1's own disclosed limitation). Every IMPLEMENTED/PARTIAL verdict above is code-and-test-conformant, not live-witnessed through a rendered UI.

---

## §20 — Full Regression

**ENVIRONMENT SAFETY:** PASS (§0).

| Suite | Result |
|---|---|
| Backend typecheck (`tsc --noEmit`) | **PASS**, 0 errors |
| Frontend typecheck (`tsc --noEmit`) | **PASS**, 0 errors |
| Backend lint | **PASS**, 0 errors |
| Frontend lint | **PASS**, 0 errors |
| Backend unit tests | **PASS — 186/186** (15/15 suites) |
| Frontend test suite | **PASS — 309/309** (73/73 files) |
| Frontend production build | **PASS** |
| Backend e2e (full, sequential/`--runInBand`, one clean uncontended run) | **PASS — 521/521 tests, 25/25 suites**, ~19.8 min wall time, zero failures |

**Regression methodology note:** an earlier attempt at this round's e2e regression was invalidated mid-flight when the scope-violating sub-fork (see Method note above) started its own concurrent parallel e2e run against the same shared local Postgres — this repo has documented, confirmed cross-suite pollution when multiple test processes hit the shared DB at once, so that run's results were discarded rather than reported. After confirming a clean process/DB baseline (0-1 stray `node.exe` processes, healthy Postgres), a single, uncontended, sequential (`--runInBand`) run was executed as the sole authoritative regression pass — sequential specifically to avoid both the DB-pollution risk and the Windows `jest-worker EPERM: kill` zombie-process bug documented during the original remediation phase. Unlike every prior full-parallel attempt in this project's history (which topped out at 516/521 with 5 environment-attributed failures), this sequential run completed with **zero failures of any kind** — no code regression, no environment flakiness. This is the first fully clean, complete backend e2e run witnessed in this project across both the remediation and re-audit phases.

---

## §21-22 — Requirements Matrix & Gap Register Updates

Both updated in place:
- `docs/requirements/CLIENT_ACCEPTANCE_MATRIX.md` — "ROUND 2 RE-AUDIT CHANGELOG" table lists every Previous Status → New Status change with evidence and reason; 3 new rows added (REQ-STUDENT-007, REQ-RBAC-013, REQ-CASE-016); a new "Customer Journey Scenarios" section added; individual rows amended in place with Round 2 evidence.
- `docs/requirements/CLIENT_REQUIREMENTS_GAPS.md` — GAP-001/002/003 marked RESOLVED; GAP-004/005/006/007 marked PARTIALLY REMEDIATED with the specific uncovered piece named (GAP-007 revised twice, see §E); GAP-022/023/024/025 (new) added; summary tally recalculated (12 MEDIUM, up from 10).
- `docs/requirements/CLIENT_REQUIREMENT_CONFLICTS.md` — CONFLICT-004 added in full.
- `docs/requirements/CLIENT_ACCEPTANCE_REPORT.md` — top-line tallies (130 total, 91/20/9/6/1/3/0) and the journey table recalculated from this round's evidence.

Nothing was silently removed; every downgrade traces to a named, cited piece of evidence.

---

## §23-24 — Final Gap Analysis & Acceptance Decision

**Mandatory CRITICAL remaining: 0.**
**Mandatory HIGH remaining: 4** — Task.output is resolved; Student Fields / Closure-Liquidation / Commission Traceability are each partially remediated with concrete, named, uncovered pieces; `Student.school` (GAP-022) is a new, fully-open HIGH finding.
**Unresolved mandatory CONFLICT: 4** (up from 3 — CONFLICT-004 new).

Per this audit's own decision rule: **FAIL requires** an unresolved mandatory CRITICAL/HIGH item that is a full failure (missing/incorrect), or an unresolved conflict that blocks acceptance outright. None of the 4 remaining HIGH items are full failures — each has a real, working, tested partial implementation with a precisely-scoped remaining piece, explicitly documented rather than hidden. **PASS WITH CONDITIONS requires** no CRITICAL/HIGH *full* failure and each remaining gap to have an explicit explanation — met.

## CLIENT ACCEPTANCE RE-AUDIT ROUND 2: **PASS WITH CONDITIONS**

The verdict label is unchanged from Round 1's own conclusion, but the *substance* underneath it is materially different. Round 1 reported 5 of 6 blockers as fully "Remediated." Round 2 independently confirms only 3 of 6 are genuinely closed, with the other 3 downgraded to "partially remediated" with specific, named residual gaps — and the Closure/Liquidation picture required a second revision mid-round once a previously-unexamined second closure mechanism (`Case.close()`) was found and read in full. The overall PASS WITH CONDITIONS verdict survives this correction only because none of the residual gaps rise to a full mandatory failure — but the conditions list the client needs to see is longer, more specific, and more honest than what Round 1 reported.

---

## Recommended Next Action

1. Do not represent GAP-004/005 (Student fields), GAP-006 (Commission traceability), or GAP-007 (Closure/Liquidation) as fully closed to the client — use this report's §D/§E/§F wording, including the role-routing nuance on Closure.
2. Small, fast fix: add `Student.school` (GAP-022) — same pattern as the already-shipped `scholarshipGoal` field.
3. Confirm HCTH's intended Student Profile access level with the client (GAP-023) before deciding whether to add a grant.
4. Get the client's answer on the 4 formal conflicts (payment threshold, SYSTEM_ADMIN role, Partner case-scoping, GPA requiredness) before attempting any further code change in those areas — do not resolve by assumption.
5. The Closure/Liquidation gap needs a design conversation, not a quick patch: decide whether ADMIN_FINANCE gets a scoped path to the Case-level service-completion checks (or vice versa), add a document-handover confirmation step (present in neither existing path), add a real two-party liquidation confirmation, and decide whether Case/Contract closure states should be synchronized.
6. Consider a full `seed.ts`-vs-sheet03 cell-by-cell RBAC audit — the "Hạn chế→zero" under-provisioning pattern has now recurred 4 times across 3 roles, suggesting a systematic issue in how the original seed was built, not 4 unrelated oversights.
7. Do not begin a new feature phase. Do not deploy from this report alone.
