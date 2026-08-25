# Client Clarification — Technical Appendix

Companion to `docs/requirements/CLIENT_CLARIFICATION_SIGNOFF.md`. This appendix is for **technical review only** — it maps each of the 9 pending decisions (DEC-01 through DEC-09) to the exact entities, APIs, frontend routes, permissions, database relations, and expected implementation impact, so engineering can scope work quickly once the client answers. **No code, schema, or configuration was changed to produce this document.** Nothing here has been implemented — every "expected migration impact" and "regression impact" note is a forward-looking estimate, not a completed change.

---

## DEC-01 — Payment activation threshold

**Affected entities:** `Contract`, `Payment`.
**Affected APIs:** `PATCH /contracts/:id/status` → `ContractsService.updateStatus()` (`apps/api/src/modules/commercial/contracts/contracts.service.ts`, SIGNED→ACTIVE branch).
**Affected frontend routes:** `apps/web/app/(staff)/contracts/[id]/page.tsx` (status-change dialog + hint text).
**Affected permissions:** none — no permission change involved, purely a business-rule threshold.
**Affected database relations:** none — no schema change for Option A (current) or B (percentage/deposit); Option C (full payment) also needs no schema change, only a different aggregate comparison against `Payment.amount`/`Contract.contractValue`.
**Expected migration impact:** **None** for any option — this is a service-layer query change (`payment.count(...)` → a sum/percentage comparison), not a schema change.
**Regression impact:** Low — confined to `contracts.e2e-spec.ts`'s "activation — payment-gated (GAP-002)" describe block; would need new/adjusted test cases for whichever threshold is chosen (e.g., a test asserting rejection below the new threshold).

---

## DEC-02 — SYSTEM_ADMIN role

**Affected entities:** `RoleCode` enum, `RolePermission` seed data (`database/seeds/seed.ts`).
**Affected APIs:** none currently exposed differently by role name — this is a documentation/sign-off item only for Options A/C.
**Affected frontend routes:** none.
**Affected permissions:** none change if Option A/C chosen (current scope retained). Option B (remove role, fold into EXECUTIVE_DIRECTOR) would require re-pointing `users`/`audit_logs`/`jobs` admin grants onto the `EXECUTIVE_DIRECTOR` block and removing the `SYSTEM_ADMIN` enum value — a breaking change for any seeded `SYSTEM_ADMIN` user accounts.
**Affected database relations:** Option B only — would touch the `User.roleId`/`RoleCode` enum and any existing `SYSTEM_ADMIN`-assigned user rows.
**Expected migration impact:** None for A/C. For B: an enum-value removal migration plus a data-migration step to reassign existing `SYSTEM_ADMIN` users to `EXECUTIVE_DIRECTOR`.
**Regression impact:** None for A/C. For B: any test fixture or seed data referencing `SYSTEM_ADMIN` would need updating (used across several `*.e2e-spec.ts` auth setup blocks).

---

## DEC-03 — Partner data access scope

**Affected entities:** `Partner`, `PartnerStudentLink`, `Case`.
**Affected APIs:** `PartnersService.list()` / `.getById()` (`apps/api/src/modules/partners/partner-master/partners.service.ts`).
**Affected frontend routes:** `apps/web/app/(staff)/partners/page.tsx`, `apps/web/app/(staff)/partners/[id]/page.tsx`.
**Affected permissions:** none change to the RBAC grant model itself — Option B would add a *record-level scope filter* on top of the existing role-permission gate (same pattern as `ScopePolicyService`'s existing Student/Contract/Case filters), not a new permission.
**Affected database relations:** Option B would need a queryable path from `Partner` to "cases the current user is connected to" — likely via `PartnerStudentLink.studentId` → `Case`, or a direct `Case`↔`Partner` link if one doesn't already exist end-to-end. Needs a design pass, not just a filter clause, since `Partner` today has no direct FK to `Case`.
**Expected migration impact:** Option A/C: none. Option B: possibly none if the existing `PartnerStudentLink` chain is sufficient to derive relevance; otherwise a new relation may be needed.
**Regression impact:** Option B would need new e2e coverage proving the scope filter (analogous to existing Student/Contract/Case scope tests) and could change existing "sees full partner list" assertions in `partners.e2e-spec.ts`.

---

## DEC-04 — Student.gpa requiredness

**Affected entities:** `AcademicRecord` (specifically the `gpa` field).
**Affected APIs:** `AssessmentsService.assertStudentProfileComplete()` (`apps/api/src/modules/counseling/assessments/assessments.service.ts`).
**Affected frontend routes:** `apps/web/components/crm/profile-evidence/academic-record-dialog.tsx`, `apps/web/app/(staff)/cases/[id]/profile/page.tsx`.
**Affected permissions:** none.
**Affected database relations:** none — `AcademicRecord.gpa` is already nullable; Option B (make optional) is a service-layer check removal, not a schema change.
**Expected migration impact:** None for any option.
**Regression impact:** Option B would need `assessment-roadmap.e2e-spec.ts`'s "Assessment approval requires a complete Student profile (GAP-004/GAP-005)" block updated — several tests currently assert `STUDENT_PROFILE_INCOMPLETE` when GPA is missing; those would need to change or be removed depending on the chosen option.

---

## DEC-05 — Student.school field

**Affected entities:** `Student` (new field).
**Affected APIs:** `CreateStudentDto`/`UpdateStudentDto` (`apps/api/src/modules/case-management/students/dto/`), `StudentsService.create()`/`.update()`.
**Affected frontend routes:** `apps/web/components/crm/students/student-form-dialog.tsx`, `apps/web/app/(staff)/students/[id]/page.tsx`.
**Affected permissions:** none — would inherit the same field-visibility rules as the recently-added `scholarshipGoal` field (visible to all roles with `students:view`, no redaction needed — sheet04 doesn't flag it sensitive).
**Affected database relations:** new nullable `Student.school String?` column (additive-only, consistent with this project's migration convention — same pattern as the `scholarshipGoal` migration).
**Expected migration impact:** One small additive migration: `ALTER TABLE students ADD COLUMN school TEXT;` (nullable, no backfill needed, no data loss risk). If the client instead wants a structured relation to a master school list (open question #3 in the sign-off doc), the impact is larger — a new `School` reference table plus a FK, not a scalar column.
**Regression impact:** Low if scalar text field (mirrors the `scholarshipGoal` precedent exactly — same DTO/form/test-fixture pattern already proven this project). Existing test fixtures (`students.e2e-spec.ts`, various `.test.tsx` files) would need the new field added to mock objects, same as was done for `scholarshipGoal` this session.

---

## DEC-06/07/08 — Closure / Liquidation design

**Affected entities:** `Contract` (`status`, `closureReason`, `liquidatedAt`), `Case` (`status`, closure preconditions).
**Affected APIs:**
- Path A (Contract-level): `PATCH /contracts/:id/status` → `ContractsService.updateStatus()` (`contracts.service.ts:298-316`).
- Path B (Case-level): `PATCH /cases/:id/close` → `CasesService.close()` (`cases.service.ts:181-230`).
**Affected frontend routes:**
- Path A: `apps/web/app/(staff)/contracts/[id]/closure/page.tsx`.
- Path B: close dialog on `apps/web/app/(staff)/cases/[id]/page.tsx`.
**Affected permissions:** `cases:close` (currently EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT) vs. `contracts:edit` (ADMIN_FINANCE). **Any resolution that lets one role complete the whole workflow requires either a new grant** (e.g., `cases:close` added to ADMIN_FINANCE, or a narrower cross-role permission) **or a hand-off mechanism between the two roles** — this is the central open design question and cannot be scoped further until DEC-06/07 are answered.
**Affected database relations:** if a document-handover confirmation is added (currently implemented nowhere), it needs a new field or small entity — e.g., a boolean/timestamp on `Contract` or `Case`, or a dedicated `ClosureChecklist` entity if the client wants itemized tracking rather than a single flag. If a structured two-party liquidation confirmation is added (replacing the current free-text `closureReason`), likely a new small entity (`LiquidationConfirmation` with two confirming-party references) rather than a single field, since "two-party" implies two separate confirmation actions.
**Expected migration impact:** **Cannot be scoped precisely until DEC-06/07/08 are answered** — ranges from a small additive field (document-handover boolean) to a new entity (structured liquidation confirmation) to a permission/role change (no migration, but a `seed.ts` update). Flag this explicitly to the client: this decision has the widest possible technical impact range of the 9 decisions.
**Regression impact:** Any change here touches `contracts.e2e-spec.ts`'s "closure — payment-checked COMPLETED, reasoned LIQUIDATED (GAP-007)" block and potentially `case-management.e2e-spec.ts`'s `Case.close()` coverage — both would need new test cases for whichever preconditions are added, and existing tests may need adjustment if the closure role set changes.

---

## DEC-09 — Commission ↔ Visa traceability

**Affected entities:** `CommissionTransaction`, `PartnerStudentLink`, `Visa`.
**Affected APIs:** `CommissionTransactionsService.resolveSource()` / `.create()` (`apps/api/src/modules/partners/commission-transactions/commission-transactions.service.ts`), `PartnerStudentLinksService.create()`.
**Affected frontend routes:** `apps/web/app/(staff)/commission-transactions/[id]/page.tsx`, `apps/web/components/crm/partner-student-links/partner-student-link-form-dialog.tsx`.
**Affected permissions:** none — would inherit existing `commission_transactions`/`partner_student_links` grants.
**Affected database relations:**
- Model A (direct FK): new nullable `CommissionTransaction.visaId String?` + `PartnerStudentLink.visaId String?`, each with an indexed FK to `Visa`, `ON DELETE SET NULL` — same pattern as the already-shipped `contractId`/`scholarshipApplicationId` fields.
- Model B (resolved-at-calculation-time reference): same schema as Model A, but populated by service-layer resolution logic rather than accepted as manual DTO input.
- Model C (polymorphic multi-hop): no new FK column: extends `resolveSource()`'s existing `sourceType`/`sourceId` resolution to optionally walk one more hop to a `Visa` when the source chain passes through one (mirrors the existing Payment→Contract one-hop pattern) — a service-layer-only change.
- Model D (no direct field): no schema change at all; reporting queries would join through the existing `Student.visas` relation instead.
**Expected migration impact:** Model A/B: one small additive migration (2 nullable columns + indexes), same shape as the `20260824161414_commission_partner_link_contract_traceability` migration already shipped this project. Model C/D: no migration.
**Regression impact:** Model A/B/C would need new e2e coverage in `partners.e2e-spec.ts`'s existing "contractId (GAP-006)" / "contractId traceability (GAP-006)" blocks, extended to cover the Visa leg the same way. Model D needs no new backend tests, only a reporting-query change if/when a report actually needs this join.

---

## Cross-cutting notes

- **None of the 9 decisions require a production data change or a destructive migration** — every proposed option in the sign-off document is additive (new nullable column, new optional entity, or a service-layer condition change), consistent with this project's existing "migrations are additive-only" convention.
- **No decision here requires touching `apps/api/src/modules/identity/rbac/field-policy.service.ts`'s redaction rules** — none of the candidate new fields (`school`, `visaId`, a document-handover flag) are flagged sensitive by the customer Excel, so no new redaction rule is anticipated regardless of which options are chosen.
- **Total estimated migration count if every recommended option in the sign-off document is accepted as-is:** 2 (one for `Student.school`, one for `CommissionTransaction.visaId`/`PartnerStudentLink.visaId`) — DEC-01/02/03/04 need no schema change under their respective recommended options; DEC-06/07/08 cannot be estimated until answered.
