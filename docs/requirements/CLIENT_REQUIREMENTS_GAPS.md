# Client Requirements — Gap & Conflict Register

Companion to `CLIENT_ACCEPTANCE_MATRIX.md`. This file lists every MISSING / INCORRECT / CONFLICT finding with severity + type classification, plus the full CONFLICT write-ups the audit task requires. Ranked most-severe first within each type. "Mandatory" = the customer Excel marks the row "Bắt buộc"; findings against non-mandatory ("Khuyến nghị"/"Normal"/"Tùy mục tiêu") rows are listed but do not drive the FAIL decision on their own.

Severity definitions used (per audit instructions): CRITICAL = core workflow broken / security violation / financial integrity issue / data isolation impossible / required workflow completely missing. HIGH = mandatory requirement materially incomplete / important role blocked from a required workflow / data model violates requirement / contract-payment-security issue. MEDIUM = important UX/workflow gap, partial requirement, operational limitation. LOW = wording/UI/detail mismatch.

**RE-AUDIT ROUND 2 (2026-08-25) note:** Full detail in `docs/requirements/CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md`. Round 2 independently re-derived every "REMEDIATED" status below from the Excel wording rather than accepting the remediation report's own framing. Result: GAP-001/002/003 (Export, Payment-gate, Task.output) are genuinely and fully closed — confirmed RESOLVED. GAP-004/005/006/007 (Student fields, Commission traceability, Closure/Liquidation) are only **PARTIALLY REMEDIATED** — real, solid partial fixes, but each still has a concrete uncovered piece of the original mandatory requirement, detailed inline below. One **new HIGH finding** (GAP-022, `Student.school` field completely unimplemented) was found. Status tags below now use RESOLVED / PARTIALLY REMEDIATED / OPEN / DEFERRED / CONFLICT per the Round 2 instructions, replacing the old "REMEDIATED" label.

---

## CRITICAL findings

### GAP-001 — Export Control not implemented anywhere (mandatory, sheet07 row6 + sheet09 row8)
**STATUS: RESOLVED (2026-08-25, confirmed Round 2)** — `EXPORT_ROW_CAP=5000` + `enforceExportRowCap` applied to all 4 export endpoints (confirmed via a fresh repo-wide grep that exactly 4 export endpoints exist, all 4 capped, all 4 field-redacted); 409 `EXPORT_ROW_LIMIT_EXCEEDED` on overflow, never silent truncation. See docs/ASSUMPTIONS.md ASM-87 (the 5000 threshold is an engineering decision pending client confirmation, not a customer-specified number) and `CLIENT_ACCEPTANCE_MATRIX.md` REQ-AUDIT-005/REQ-SEC-007. Cosmetic-only residual: the code comment cites the wrong assumption ID (ASM-70 instead of ASM-87), zero functional impact.
**Type:** CODE BUG / SECURITY. **Requirement rows:** REQ-AUDIT-005, REQ-SEC-007.
Every export endpoint (`students.service.ts:127-131`, `reports.service.ts:150`, `payments.service.ts:271`, `contracts` export) runs an unbounded Prisma `findMany` with no `take`/`limit` and no row-count cap. A role with broad scope (GĐĐH, Trưởng phòng) can export its entire allowed dataset — every student, every contract, every payment — in a single unaudited-for-volume call. The action is logged (rowCount recorded after the fact), but nothing *prevents* the mass export the customer explicitly marked mandatory to block ("Không cho export hàng loạt", "Bắt buộc").
**Recommendation:** Add a hard server-side row-count cap to every export query (reject or paginate beyond N rows), or require a second-step approval for exports above a threshold.

### GAP-002 — Contract can activate (SIGNED→ACTIVE) with zero payment recorded (mandatory, sheet11)
**STATUS: RESOLVED (2026-08-25, confirmed Round 2)** — SIGNED→ACTIVE now requires at least one Payment PARTIALLY_PAID/PAID (409 `PAYMENT_REQUIRED_FOR_ACTIVATION`), race-safe via an interactive transaction + compare-and-swap (concurrency e2e test re-read line-by-line, confirmed it asserts the actual compare-and-swap outcome, not just a status code). **The exact threshold ("any payment" vs. a specific amount) was never customer-specified** — registered as CONFLICT-001, not silently assumed final. See docs/ASSUMPTIONS.md ASM-88. Round 2 note: the customer sheet names the activation actor as "Hệ thống" (System, automatic-on-payment); the implementation requires an explicit manual staff action instead — the gate itself is unaffected, logged as a LOW-severity automation-semantics note, not a defect.
**Type:** CODE BUG. **Requirement row:** REQ-CONTRACT-002.
`ContractsService.updateStatus` (contracts.service.ts:249-280) allows SIGNED→ACTIVE with no check against `Payment` records at all. The customer's 11-stage contract sequence places PAYMENT as its own stage between SIGNED and ACTIVE, implying activation should be payment-gated. As built, a contract becomes ACTIVE (triggering task generation, case linkage, service delivery) with the family having paid nothing.
**Recommendation:** Add a precondition to the ACTIVE transition requiring at least one non-pending `Payment` (or a specific minimum-paid threshold, to be defined with the client) before allowing activation — or obtain explicit written client sign-off that payment tracking is intentionally decoupled from the activation gate.

---

## HIGH findings

### GAP-003 — Task.output never enforced, contradicts explicit mandatory rule (sheet00 row9, sheet06)
**STATUS: RESOLVED (2026-08-25, confirmed Round 2)** — DONE transition now requires non-empty `output` (mirrors the BLOCKED/blocker precedent), 409 `OUTPUT_REQUIRED` otherwise. Bypass check: every code path that can set `Task.status='DONE'` (staff `updateStatus`, portal `portalUpdateStatus`) confirmed to funnel through the same `applyStatusTransition` gate — no parallel/looser path found. See docs/ASSUMPTIONS.md ASM-89.
**Type:** CODE BUG. **Requirement row:** REQ-TASK-004.
Customer states unconditionally: "Mọi công việc phải có Owner + Deadline + Output + Status." `Task.output` is nullable in the schema, absent from `CreateTaskDto` entirely, and optional even in `UpdateTaskStatusDto` when transitioning to DONE — with zero enforcement (contrast: the BLOCKED transition *does* require a non-empty `blocker`). A task can complete its full lifecycle with `output` permanently null.
**Recommendation:** Mirror the existing BLOCKED/blocker pattern — require non-empty `output` as a precondition for the DONE transition.

### GAP-004 — Student.school/grade/gpa/date_of_birth: required fields missing or optional (sheet04)
**STATUS: PARTIALLY REMEDIATED, stage-aware (confirmed Round 2 — `school` still fully missing, see new GAP-022)** — `AcademicRecord.grade` field added; Assessment approval now hard-blocks (409 `STUDENT_PROFILE_INCOMPLETE`) unless `dateOfBirth` + a grade+GPA AcademicRecord both exist. Still nullable at the DB level by design (enforced at Assessment approval, not Student creation — see docs/ASSUMPTIONS.md ASM-90; Round 2 reclassifies this as PARTIAL rather than fully remediated, since the Excel gives no stage qualifier and the stage choice remains an unconfirmed interpretation). **`school` was NOT addressed by this remediation at all — split out as its own finding, GAP-022, since it's a distinct absence (no column) rather than a stage-timing question.**
**Type:** DATA MODEL. **Requirement row:** REQ-STUDENT-002.
`date_of_birth` is optional in the schema; `grade`/`gpa` now live on `AcademicRecord` (grade added this remediation). All four are marked "Bắt buộc" in the customer's Student Profile sheet — note sheet17 internally disagrees with sheet04 on GPA's requiredness, logged as CONFLICT-004.
**Recommendation:** Confirm the stage choice with the client; separately, see GAP-022 for the `school` field.

### GAP-005 — Student targeting fields (target_country/target_major/intake/scholarship_goal) not enforced or missing (sheet04)
**STATUS: PARTIALLY REMEDIATED, stage-aware (confirmed Round 2)** — `Student.scholarshipGoal` field added; same Assessment-approval gate as GAP-004 also checks `targetCountry`/`targetMajor`/`targetIntake`/`scholarshipGoal`; confirmed no bypass path (Roadmap approval re-checks Assessment status). See docs/ASSUMPTIONS.md ASM-90. Round 2: kept PARTIAL rather than fully remediated for the same reason as GAP-004 — the create-vs-stage-enforcement question is still unconfirmed with the client, not because anything is functionally broken.
**Type:** DATA MODEL. **Requirement row:** REQ-STUDENT-004.
All four are "Bắt buộc" per the customer sheet and drive the entire downstream Roadmap/Scholarship/Application matching workflow. `targetCountry`/`targetMajor`/`targetIntake` are optional in the schema; `scholarship_goal` has no field at all. A Case can proceed through Assessment/Roadmap with this core targeting data entirely absent.
**Recommendation:** Enforce these as required fields (DB-level or service-level validation) before a Case can move past Assessment, and add the missing `scholarshipGoal` field.

### GAP-006 — Contract↔Partner commercial link cannot be produced from the schema (sheet16)
**STATUS: PARTIALLY REMEDIATED — HIGH severity confirmed, not a minor residual (Round 2)** — `CommissionTransaction.contractId` and `PartnerStudentLink.contractId`/`scholarshipApplicationId` added as real FKs. **Visa is still not directly joinable** (`PartnerStudentLink.visaId` deliberately deferred — see docs/ASSUMPTIONS.md ASM-91). Round 2 independently confirmed sheet16 lists Visa as a co-equal column with Application/Scholarship, no optional marker anywhere — this should be weighed at the same severity as the fixed legs, not softened. Do not report this row as fully closed.
**Type:** DATA MODEL. **Requirement row:** REQ-PARTNER-008.
Neither `CommissionTransaction` nor `PartnerStudentLink` carries a `contractId` FK; `scholarshipId` and any visa reference are absent from both models entirely. Sheet16's implied one-row-per-Contract "which partner/program/application/scholarship/visa is this contract tied to" view requires stitching multiple optional-FK hops and cannot be produced directly. This affects commission-calculation traceability (which contract actually earned a given commission) and partner-performance reporting accuracy.
**Recommendation:** Add direct `contractId` and `scholarshipId` fields to `CommissionTransaction`/`PartnerStudentLink`.

### GAP-007 — Closure/Liquidation: service-completion check exists but is unreachable by the Excel's designated role; document handover unchecked by any path (sheet11, sheet08 stage 14)
**STATUS: PARTIALLY REMEDIATED (revised twice in Round 2 — see below; the picture is more specific than "1 of 3 obligations covered")** — new dedicated page `apps/web/app/(staff)/contracts/[id]/closure/page.tsx`, real and reachable; backend gained a debt-check precondition on COMPLETED and a required liquidation-reason (`Contract.closureReason`) + date (`liquidatedAt`) on LIQUIDATED.
**Type:** CODE BUG (frontend) + workflow gap + role-routing gap. **Requirement row:** REQ-CASE-014.
Sheet11 row12 names 3 distinct COMPLETED-stage obligations: "dịch vụ hoàn thành, công nợ, tài liệu bàn giao" (service completion, debt, document handover), naming HCTH as the actor. **Round 2 discovered a second, independent closure mechanism** — `Case.close()` (`cases.service.ts:181-230`), gated to `cases:close` (EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT — **not** ADMIN_FINANCE/HCTH) — which DOES check service completion: no open tasks, no outstanding debt, no in-progress Visa, confirmed Enrollment if an Application is in progress, and a complete pre-departure checklist. So "dịch vụ hoàn thành" is genuinely enforced in the product — just via a role the Excel names for a different function (case management, not closure), while HCTH — the Excel's named closure actor — can only reach the weaker Contract-level path (debt only). **Document handover ("tài liệu bàn giao") is checked by neither mechanism.** The two closure states (`Case.status`, `Contract.status`) are not synchronized — one can close without the other. Row13's LIQUIDATED obligations ("ngày thanh lý, xác nhận hai bên") — the date is captured (`liquidatedAt`), but two-party confirmation remains a single-author free-text field; `Case.close()` has no liquidation concept at all.
**Recommendation:** This needs a design decision, not a quick patch: either give ADMIN_FINANCE a scoped path into the Case-level service-completion checks, or surface Contract-level debt status inside the Case-close flow, so one role can complete the whole workflow the Excel describes. Add a document-handover confirmation step (present in neither path today). Add a structured dual-party confirmation to LIQUIDATED. Decide whether Case/Contract closure should be linked.

### GAP-022 — Student.school ("Trường/Lớp") field completely unimplemented (sheet04 row5, mandatory) — NEW, found in Re-Audit Round 2
**STATUS: OPEN (new finding, 2026-08-25 Re-Audit Round 2)**
**Type:** DATA MODEL. **Requirement row:** REQ-STUDENT-007 (new row).
`database/schema.prisma` `model Student` (read in full) has no `school` column at all — not nullable-and-unenforced like `dateOfBirth`/`targetCountry`, genuinely absent. No `school` field exists in `create-student.dto.ts`, `update-student.dto.ts`, or `student-form-dialog.tsx`. Sheet04 row5 marks "Trường/Lớp" (current school/class) as "Bắt buộc" (mandatory) — this is the exact same requirement row as GAP-004 (REQ-STUDENT-002), but the remediation's fix for that row only addressed `dateOfBirth`/`grade`/`gpa`, missing `school` entirely.
**Recommendation:** Add `Student.school String?` plus DTO/form wiring, same pattern already used for `scholarshipGoal` this remediation phase — then decide (with the client) whether it belongs in the same Assessment-approval stage gate as the other GAP-004/005 fields.

---

## MEDIUM findings

### GAP-008 — Consultant has zero access to Partner Documents; sheet specifies "Hạn chế" (some access) (sheet03)
**Type:** CONFIGURATION. **Requirement row:** REQ-RBAC-006. Stricter-than-spec (low risk), but a real deviation.
**Recommendation:** Confirm with client whether zero access is acceptable, or add a scoped view-only grant.

### GAP-009 — HCTH under-provisioned on Partner Documents (view-only vs "Có") and Visa (zero vs "Hạn chế") (sheet03)
**Type:** CONFIGURATION. **Requirement row:** REQ-RBAC-007.
**Recommendation:** Add HCTH `partner_documents` create/edit; add a restricted HCTH `visa` view grant.

### GAP-020 — Sale/Marketing under-provisioned on Student Profile and Competition (zero vs "Hạn chế") (sheet03 rows 2, 6)
**Type:** CONFIGURATION. **Requirement row:** REQ-RBAC-012. Same "Hạn chế→zero" pattern as GAP-008/GAP-009, independently confirmed by both the backend RBAC pass (`seed.ts:581-605`, zero `students` grant) and the separate frontend RBAC pass (zero `profile_evidence` grant), which flagged it as a CONFLICT candidate before the two passes were cross-checked against each other.
**Recommendation:** Confirm with client whether zero access is acceptable for Sale/Marketing on Student Profile and Competition, or add a narrow read-only/summary-field grant on each.

### GAP-023 — HCTH (ADMIN_FINANCE) has zero access to Student Profile; sheet specifies "Hạn chế" (restricted, not zero) (sheet03 row2) — NEW, found in Re-Audit Round 2
**Type:** CONFIGURATION. **Requirement row:** REQ-RBAC-013 (new row).
`ADMIN_FINANCE` grant block (`database/seeds/seed.ts:613-641`) has no `students` resource grant of any kind — zero, not restricted. This is the 4th confirmed instance of the same "Hạn chế→zero" under-provisioning pattern already found for Consultant/Partner-Documents (GAP-008), HCTH/Partner-Documents+Visa (GAP-009), and Sale-Marketing/Student-Profile+Competition (GAP-020) — recurring across 3 different roles and 4 different module cells, which suggests a systematic issue in how the original RBAC seed was built from sheet03, not 4 unrelated oversights.
**Recommendation:** Confirm with client whether HCTH needs any Student Profile visibility (e.g. read-only name/contact, useful for correspondence about a contract) or zero is intentional. Given the pattern has now recurred 4 times, recommend a full cell-by-cell audit of `seed.ts` against sheet03 rather than patching instances one at a time.

### GAP-024 — `Case.stage` is unvalidated free text, not derived from actual sub-entity progress (sheet08) — NEW, found in Re-Audit Round 2
**Type:** DATA MODEL / workflow integrity. **Requirement row:** REQ-CASE-016 (new row).
`Case.stage` (`cases.service.ts:128,143`, `update-case-stage.dto.ts`) is `@IsString() @MaxLength(100)` with no validated value set and no derivation from the ~10 real, independently-gated sub-entity statuses (Assessment/Roadmap/Application/Offer/Scholarship/Visa/Enrollment/Contract). Any staff member with `cases:edit` can set it to any string via `PATCH .../stage`. Each individual stage's own workflow gate is real and enforced (see REQ-CASE-001 through 015) — this is specifically about the summary label users see potentially drifting from what the underlying data shows, not about any individual stage being unenforced.
**Recommendation:** Either derive `Case.stage` server-side from actual sub-entity status, or constrain it to a validated enum matching sheet08's 16 named stages.

### GAP-025 — `profile_evidence` RBAC resource is too coarse to express sheet03's per-module grant differences — NEW, found in Re-Audit Round 2 (root cause underlying GAP-020)
**Type:** CONFIGURATION / architecture. **Requirement row:** REQ-RBAC-012 (root-cause addition, not a new row).
`TestRecord`/`Competition`/`ResearchProject`/`Activity` are all gated by one shared `profile_evidence` resource (`profile-evidence.controller.ts`, every route). Sheet03 gives Sale/Marketing a *different* grant per module — "Không" on Luyện thi/NCKH/Resume-family but "Hạn chế" specifically on Competition — a distinction the current permission model cannot express even if the missing grant were added, because Competition and Luyện thi/NCKH share one gate.
**Recommendation:** Split `profile_evidence` into per-module RBAC resources, or get client agreement to a documented simplification (e.g., treat all four as one access tier).

### GAP-021 — Marketing has no standalone frontend module (sheet01 row15, sheet03 row16)
**Type:** CODE BUG (frontend) / possibly scope question. **Requirement row:** REQ-DEPT-002. No route, nav item, `lib/marketing/`, or `marketing` entry in the frontend's `Resource` permission union exists at all — Marketing-relevant data (lead source/campaign) is folded into the Lead entity instead of being a distinct module with its own per-role grant column as sheet03 describes.
**Recommendation:** Confirm with client whether "Marketing" was always meant to be Lead-source attributes (documentation/scoping fix only) or needs a real standalone module, page, and permission resource.

### GAP-010 — Partner.partner_type enum doesn't cover 6 of the 7 customer categories (sheet17)
**Type:** DATA MODEL. **Requirement row:** REQ-PARTNER-002. Actual enum: `UNIVERSITY_REPRESENTATIVE, AGENCY, LANGUAGE_CENTER, OTHER`. Required: University/School/Scholarship/Visa/Accommodation/Insurance/Recruitment.
**Recommendation:** Expand the `PartnerType` enum to match, or explicitly map and confirm with the client which categories collapse into "OTHER" today.

### GAP-011 — Partner Program ID generates with the wrong prefix (PT- instead of PP-) (sheet18)
**Type:** CODE BUG. **Requirement row:** REQ-PARTNER-005 / REQ-ID-004.
`nextPartnerProgramSuffix` concatenates the parent Partner's own `PT-CC-NNNNN` code plus a suffix, producing e.g. `PT-US-00001-01` instead of the documented `PP-US-00001-01`. Three separate doc files (`API_CONVENTIONS.md`, `DATA_DICTIONARY.md`, `ERD.md`) all describe the intended `PP-CC-NNNNN-NN` format — this is a genuine implementation bug against the project's own documentation, not an ambiguous spec.
**Recommendation:** Fix the ID generator to substitute the `PP` prefix instead of reusing the parent's `PT`-prefixed code. Low functional risk (uniqueness is unaffected) but will confuse anyone filtering/reporting by ID prefix.

### GAP-012 — Contract.contract_type field missing (sheet17)
**Type:** DATA MODEL. **Requirement row:** REQ-CONTRACT-008.
**Recommendation:** Add a `contractType` enum if the client needs to distinguish contract types beyond the existing free-text `servicePackage`.

### GAP-013 — Training (TRN) ID generation / entity entirely unimplemented (sheet18)
**Type:** CODE BUG / scope gap. **Requirement row:** REQ-ID-012. No `Training` model, service, or ID call-site exists anywhere in the backend (confirmed via full-repo grep). Note: Training is not listed among sheet01's 22 core modules, so this may be a lower-priority/future item rather than a core-workflow blocker.
**Recommendation:** Confirm with the client whether Training tracking is in scope for the current phase; if yes, build the model; if not, remove the TRN prefix from the ID rules sheet or mark it explicitly future-scope.

### GAP-014 — Encryption at rest: only the MFA secret has app-level encryption (sheet09 row13, mandatory)
**Type:** CONFIGURATION / possibly acceptable, needs client decision. **Requirement row:** REQ-SEC-012.
`Contract.value`, `Payment.amount`, `Student.budget` rely solely on the managed database's disk-level (platform) encryption, not application-level field encryption. This may fully satisfy a reasonable reading of "mã hóa dữ liệu nhạy cảm khi lưu," but the customer sheet doesn't specify which layer is acceptable.
**Recommendation:** Get an explicit client decision — platform-level encryption acceptable, or app-level field encryption required for these three fields.

---

## LOW / informational findings (non-mandatory or cosmetic)

- **GAP-015** — KPI reporting gaps (sheet06, all "Normal" priority, not mandatory): case-count-per-staff, task/case ratio, essay/resume/SOP/LOR completion counts, on-time-closure rate, "internal profile error" count, and customer-response-time SLA are all MISSING from the reporting layer. The last two ("internal profile error," "response time SLA") have no defined measurement points anywhere in the system and need a scoping conversation with the client before they can even be designed, not just built. **Type:** DATA MODEL / scope-undefined.
- **GAP-016** — Frontend role-nav is a static hand-authored mirror of the backend RBAC seed (`ROLE_GRANTS` in `rbac-data.ts`), explicitly commented as "UX ONLY... every grant re-checked server-side." Not a security hole, but a real drift-risk if the backend seed changes without a matching frontend update. **Type:** ENVIRONMENT / maintenance risk.
- **GAP-017** — `AuditLog.action`, `Document.document_type`, and `Task.output`'s sibling `Task.status`-adjacent fields use free-text `String` where the customer dictionary specifies an Enum (action, document_type). Low risk since these appear to be validated at the application layer even without a DB-level enum, but worth tightening. **Type:** DATA MODEL.
- **GAP-018** — List/browse endpoints (`GET /students`, `GET /contracts`, etc.) are not `@Audit`-decorated — only single-record VIEW is captured. Sheet07's own example row only shows single-record VIEW, so this may be intentional; flagging for client confirmation rather than as a confirmed defect. **Type:** CONFIGURATION, ambiguous severity.
- **GAP-019** — `PartnersService.getById` takes no `principal` and performs no record-level scope check (relies only on the role-permission gate) — inconsistent with Student/Contract's pattern. Low risk since Partner data appears intentionally GLOBAL-readable by every granted role by design, but the inconsistency itself (vs. the project's own stated "no ID-based authorization" rule) is worth a deliberate decision rather than an accidental one. **Type:** CODE BUG (architecture inconsistency), severity depends on client's answer to GAP-020.
- **The project's local `.env` currently points `DATABASE_URL` at the production Supabase database**, not the local Docker Postgres — discovered incidentally while attempting to set up an isolated UAT test environment for this audit (see `CLIENT_UAT_SCENARIOS.md`). Not a customer-requirements gap, but an operational-hygiene risk worth fixing: anyone running a local migrate/seed command without checking `.env` first could accidentally target production. **Type:** ENVIRONMENT.

---

## CONFLICT register (customer requirement vs. implementation, ambiguous or genuinely divergent — requires client decision, not silent resolution)

### CONFLICT-001 — Contract status sequence (11 stages vs. 9 implemented; PAYMENT and AMENDED not modeled as statuses)
Already fully detailed in `CLIENT_ACCEPTANCE_MATRIX.md` under REQ-CONTRACT-001. Summary: customer's literal 11-value sequence includes PAYMENT and AMENDED as Contract-level statuses; implementation models Payment as a separate child entity and Amendment as a separate audit-trail entity + version counter, neither ever appearing in `Contract.status`. GAP-002 above is the concrete functional consequence (no payment gate). **Customer acceptance required: YES.**

### CONFLICT-002 — SYSTEM_ADMIN role not named in customer sheets 02/03
**Customer says:** 7 roles total, exhaustively listed in sheet02 (GĐĐH, Trưởng phòng, Tư vấn, Hồ sơ, Sale/Marketing, HCTH, HS/PHHS).
**Current implementation:** An 8th `RoleCode`, `SYSTEM_ADMIN`, exists — narrowly scoped to `users`/`audit_logs`/`jobs` administration, zero business-data grants.
**Difference:** A platform/IT-operations role outside the customer's business-role taxonomy.
**Current DECISION/ASSUMPTION:** None found in `docs/DECISIONS.md`/`docs/ASSUMPTIONS.md` addressing this specific role's existence against the customer's exhaustive 7-role list.
**Impact:** Low — the role carries zero business-data exposure and satisfies the customer's own Offboarding/Session-Control requirements (sheet09), which need *some* identity-administration actor. But it was never reviewed against the customer's explicit, closed role list.
**Recommendation:** Formally document SYSTEM_ADMIN's existence and scope for client sign-off; no code change needed unless the client objects.
**Customer acceptance required: YES** (a documentation/sign-off gap, not a functional one).

### CONFLICT-003 — "Đối tác chỉ xem dữ liệu được chia sẻ theo từng case" (sheet09 row18) — ambiguous scope
**Customer says:** Partner access is restricted to data shared per-case.
**Current implementation:** No external partner-facing login/portal exists anywhere — Partner is purely an internal-staff-managed CRM record set. Internally, `PartnersService.list/getById` apply **no case-ownership filter at all** — every role holding any `partners:view` grant sees every Partner row globally.
**Difference:** The requirement is genuinely ambiguous between two readings: (a) an *external* partner-login control (in which case it's NOT_APPLICABLE — no such login surface exists to scope), or (b) an *internal staff* case-scoping rule (in which case it's a real, unaddressed gap — internal roles currently see all partners regardless of case relevance).
**Current DECISION/ASSUMPTION:** None found addressing which reading was intended.
**Impact:** Low if reading (a) was intended (nothing to fix); Medium if reading (b) was intended (a real internal over-exposure, though bounded by role-permission gating, not a raw data leak to unauthorized roles).
**Recommendation:** Ask the client directly which reading was intended; if (b), add a case-scope filter to Partner list/read queries analogous to `ScopePolicyService`'s existing Student/Contract/Case filters.
**Customer acceptance required: YES.**

### CONFLICT-004 — Student.gpa requiredness: sheet04 vs. sheet17 disagree (found in Re-Audit Round 2)
Full detail in `docs/requirements/CLIENT_REQUIREMENT_CONFLICTS.md`. Summary: sheet04 row6 marks GPA "Bắt buộc"; sheet17 row7 marks the same field "Optional" — the customer's own two source sheets disagree with each other. The current implementation happens to follow sheet04 (enforced at Assessment approval), but this was not a deliberate documented tie-break. **Customer acceptance required: YES.**

---

## Summary tally — RE-AUDIT ROUND 2 (2026-08-25; see `CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md` for full methodology)

- CRITICAL: 0 (GAP-001, GAP-002 — both independently confirmed RESOLVED)
- HIGH: 6 — GAP-003 RESOLVED; GAP-004, GAP-005, GAP-006, GAP-007 downgraded to PARTIALLY REMEDIATED (real partial fixes, each with a concrete uncovered piece, detailed above — GAP-007's picture refined further mid-round, see its entry); **GAP-022 (NEW) — `Student.school` field completely unimplemented, OPEN**
- MEDIUM: 12 (GAP-008 through GAP-014, GAP-020, GAP-021 unchanged, code not touched by remediation, re-verified via git diff against the pre-remediation baseline; **GAP-023 NEW** — ADMIN_FINANCE zero access to Student Profile, 4th instance of the "Hạn chế→zero" pattern; **GAP-024 NEW** — `Case.stage` unvalidated free text; **GAP-025 NEW** — `profile_evidence` resource too coarse, root cause under GAP-020)
- LOW/informational: 6 (GAP-015 through GAP-019, plus the `.env` note) — unchanged; note the `.env` item was corrected during the remediation phase itself (local `.env` now correctly points at local Docker Postgres) but is left listed here as the historical finding it was
- CONFLICT requiring explicit customer decision: 4 (CONFLICT-001 through 003 unchanged and still fully open; **CONFLICT-004 NEW**)

**Round 2 revision note:** Of the 4 previously-HIGH findings addressed by remediation (GAP-003 through 007 excluding the 2 CRITICAL), only GAP-003 (Task.output) is genuinely fully closed. GAP-004/005 (Student fields) are solid for 7 of 8 named fields but missed `school` entirely (now GAP-022). GAP-006 (Commission traceability) fixed 2 of 3 named link legs (Contract, Scholarship) but not Visa. GAP-007 (Closure/Liquidation) built a real, reachable, debt-checked UI, and a second closure path (`Case.close()`) turned out to already enforce service-completion — but that path is unreachable by HCTH, the role the Excel names for closure; document handover is checked by neither path; two-party liquidation confirmation remains unenforced free text. None of these are regressions or fabricated fixes — each partial fix is real, tested, and an improvement over the pre-remediation state — but none should be reported to the client as fully closed.

**Journeys/UX correction (Round 2):** Journey I (Parent Portal / linked-child) was carried forward from Round 1 as IMPLEMENTED without the code ever having been opened. Round 2 opened it — `portal-access.service.ts:160-165` genuinely, server-side resolves every linked student via the real `StudentContact` table. Confirmed IMPLEMENTED, upgraded from an unverified to a verified claim, not a new gap.
