# Final Architect Review — Phase 14

Scope: `14-production/02_FINAL_ARCHITECT_REVIEW.md` — a fresh, whole-system comparison of the actual implementation against SRS + architecture + domain model + RBAC + database + API + security + UAT, deliberately focused on what Phase 13's exhaustive audit (`docs/REQUIREMENTS_TRACEABILITY.md`, `docs/security/SECURITY_TEST_REPORT.md`, `docs/UAT_FINDINGS.md`) did not specifically hunt for: duplicate entities, wrong/missing FKs, missing indexes, dead code, unused permissions/fields, races beyond the one already found, idempotency gaps, payment edge cases, legal-record-overwrite, application/scholarship duplication, partner/commission contamination, and dashboard correctness.

**Result: 2 HIGH findings, both fixed. 4 MEDIUM findings — 3 fixed, 1 documented (not fixed, low-risk consistency-only). 1 LOW finding, folded into an existing documented assumption. 5 areas confirmed clean with no issue.**

**Status note**: this review's findings are architectural/application-layer only. A subsequent go-live attempt confirms the application layer has no remaining CRITICAL/HIGH defect but was blocked at pre-flight for entirely separate, infrastructure-layer reasons (no production database/TLS/CI/backup automation exist) — see `docs/production/GO_LIVE_REPORT.md`.

---

## 1. Duplicate entities / inconsistent terminology

**MEDIUM — documented, not fixed.** No duplicate entities exist (Student/Case/Contract/Partner/Document/Application/Offer/Visa/Enrollment each have exactly one canonical model — confirmed, no finding there). However, 13 actor-attribution fields across the schema (`approvedById` ×4, `verifiedById` ×3, `createdById` ×2, `reviewedById`, `refundedById`, `waivedById`, `revokedById`) are plain unconstrained `String`/`String?` columns with no `@relation` to `User`, while two structurally identical fields (`uploadedById`, `invitedById`) DO have real named relations. This is a naming/consistency inconsistency, not a bug — Hard Rule #5 (no hard-delete of Users) means there's no orphan-reference risk in practice, and every one of these fields is populated from `principal.userId` server-side, never client input, so it isn't a data-integrity or security gap either.

**Decision**: Not fixed — retrofitting 13 FK constraints across many tables is real migration surface for a purely cosmetic/consistency improvement, out of proportion to the risk. Documented here as a known inconsistency for a future phase to clean up opportunistically (e.g. the next time one of these tables gets touched for an unrelated reason).

## 2. Wrong/missing foreign keys

**No issue found beyond §1.** Every polymorphic loose reference in the schema (`Comment.entityId`, `Approval.entityId`, `VisaChecklistItem.entityId`, `AuditLog.objectId`, `CommissionTransaction.sourceId`) is deliberately typed and documented as polymorphic — not a missed FK, a conscious design choice (a single `Comment`/`Approval`/audit mechanism reused across many entity types, per the project's own "don't duplicate business logic" discipline).

## 3. Missing indexes

**MEDIUM — fixed.** `DocumentAccess` had only its `@@unique([documentId, principalId, permission])` constraint (leading with `documentId`), giving `DocumentsService.listAccessibleTo` — which filters by `principalId` alone — no index support at all. **Fix**: added `@@index([principalId, permission])` (migration `20260820040000_document_access_index_phase14`, purely additive). Payment/Task/AuditLog/Notification/CommissionTransaction (the highest-row-count tables) were all independently re-checked and are correctly indexed for their actual query patterns — no other gap found.

## 4. Stale/dead modules and dead routes

**No issue found.** Every controller class is registered in some module (programmatically verified, zero orphans).

## 5. Unused permissions

**No issue found.** The seed.ts master `PERMISSIONS` list (106 resource:action pairs) was diffed against every `@RequirePermission(...)` usage across all controllers — exact match in both directions: zero seeded-but-ungated permissions, zero used-but-ungrantable permissions.

## 6. Unused schema fields

Spot-checked (not exhaustive — the ~15 largest/most complex models); no confident finding beyond what §1/§3 already cover.

## 7. Race conditions / TOCTOU beyond what Phase 13 found

**LOW — folded into the existing documented assumption.** `ApplicationsService.assertNoActiveDuplicate` has the identical check-then-create shape as the already-documented Case-creation race (Phase 13, `docs/ASSUMPTIONS.md` ASM-57). Same reasoning applies; ASM-57 has been generalized to name both instances rather than creating a duplicate entry. No other new instance of this pattern was found.

## 8. Idempotency gaps

**No issue found.** Every registered background-job processor (`DOCUMENT_SCAN`, `EMAIL_DISPATCH`, `REMINDER_SWEEP_TASK`/`REMINDER_SWEEP_PAYMENT`, `EXTERNAL_DATA_SYNC`) re-fetches live state and either no-ops or writes an upsert-shaped result — none assumes single-execution in a way that would break under the job runner's at-least-once delivery guarantee.

## 9. Payment edge cases

**MEDIUM — both fixed.**
- Refund-exceeds-paid and waive-already-paid were re-verified and are correctly protected (unchanged, no finding).
- **Currency cross-validation was missing**: `createInstallment` accepted a Payment `currency` with no check against its own Contract's `currency` — a genuine inconsistency, since `CommissionTransactionsService.calculate()` enforces the equivalent rule-vs-source currency match elsewhere in the same codebase. **Fix**: `createInstallment` now rejects a mismatched currency (`CURRENCY_MISMATCH`, 409).
- **No contract-status guard on payment mutation**: an installment could be created, or a payment recorded, against a Contract already `LIQUIDATED`/`ARCHIVED` — "financial activity on a closed-out record." **Fix**: `createInstallment` and `recordPayment` now reject (`CONTRACT_CLOSED`, 409) against a terminal-status contract. Deliberately **not** applied to `refund()`/`waive()` — those remain legitimate corrective actions on an *existing* payment even after contract closure (e.g. an early-termination settlement, or writing off a balance as part of reaching closure itself); only *new* financial obligations against an already-closed-out contract are blocked. Both fixes verified with new regression tests, including one proving refund/waive specifically remain reachable post-liquidation while creation/recording do not.

## 10. Legal record overwrite

**No issue found.** `Contract.sign()` blocks re-signing (`requireStatus(['SENT'])`); Document versioning and Assessment/Roadmap approval gates were re-checked and remain correctly guarded — unchanged from Phase 13's verification.

## 11. Duplicate Application / Scholarship duplication

**No issue found — design confirmed, not assumed.** `assertNoActiveDuplicate` scopes on `studentId + programId + intendedIntake` — precisely "same Program **and** same intake," a deliberate, documented definition, not merely "same Program."

## 12. Partner/commission contamination

**HIGH — fixed.** `CommissionTransactionsService.create()` validated that the `CommissionRule` used belongs to the target `partnerId`, but never validated that the transaction's *source* (the actual Student/Case the commission is computed from) has any real relationship to that partner at all. A finance/ED/DM actor — fully authorized to call this endpoint — could attribute commission to Partner A for a source student with no `PartnerStudentLink` to Partner A whatsoever (or one linked to a completely different Partner B). This is a real financial-attribution integrity gap, not a hypothetical: nothing in the prior implementation or tests exercised or prevented it.

**Fix**: `create()` now requires an ACTIVE `PartnerStudentLink` between `partnerId` and the transaction's effective student (`dto.studentId ?? source.studentId`) before allowing creation — `PARTNER_STUDENT_LINK_REQUIRED` (409) otherwise. An archived (not active) link does not satisfy the check. All pre-existing commission-transaction e2e tests (which had never established this relationship at all) were updated to establish it explicitly via a new `linkPartnerToStudent()` test helper — itself part of what the fix now correctly requires — plus two new regression tests proving the rejection (no link at all; an archived-not-active link).

## 13. Dashboard errors

**HIGH — fixed.** `ReportsService.executiveDashboard()` summed `revenue`/`receivables` across **all** `Payment` rows via raw `Decimal` addition with no currency grouping — `Payment`/`Contract` both carry a per-record `currency` (multi-currency is a real, intended scenario: different destination-country contracts), so the moment more than one currency exists in the table, the displayed figure becomes numerically meaningless (e.g. 1000 USD + 1000 GBP reported as a bare "2000"). No test exercised a multi-currency fixture against this endpoint, so it was untested as well as unguarded.

**Fix**: `revenue`/`receivables` are now grouped by currency (`[{currency, amount}, ...]` instead of a single flat string), computed via a new `sumByCurrency` helper reused for both fields. Both existing tests asserting the old flat-number shape were updated to the new array shape (one asserting the shape itself, one independently re-deriving the per-currency aggregation from live `Payment` rows and matching it entry-by-entry). A new regression test creates a real GBP contract+payment end-to-end and confirms the GBP total is correct and reported separately from the pre-existing USD total — proving no cross-currency mixing, not just asserting the absence of a bug.

---

## Summary of findings and fixes

| # | Severity | Area | Status |
|---|---|---|---|
| 12 | HIGH | Commission/partner attribution — no PartnerStudentLink validation | **Fixed** |
| 13 | HIGH | Executive dashboard sums revenue/receivables across currencies | **Fixed** |
| 3 | MEDIUM | `DocumentAccess` missing index for its actual query pattern | **Fixed** |
| 9a | MEDIUM | Payment installment currency not validated against Contract currency | **Fixed** |
| 9b | MEDIUM | No contract-status guard on new payment activity | **Fixed** |
| 1 | MEDIUM | 13 actor-attribution fields lack `@relation` to User (naming/consistency only) | Documented, not fixed |
| 7 | LOW | Application creation has the same check-then-create race as the already-documented Case race | Folded into `docs/ASSUMPTIONS.md` ASM-57 |

No CRITICAL findings. Both HIGH findings are fixed, each with a real regression test proving the fix (not just proving the absence of an error). Full regression suite (163 unit + 466 e2e, +6 new tests from this phase's fixes) re-run green after every fix.

## Final classification

See `docs/phase-status/PHASE_14.md` for the full release-readiness assessment across all of Phase 14's scope (environment/secrets, database/migrations, backup/restore, storage, security baseline, API hardening, background jobs, observability, deployment, CI/CD, dependencies) — the architecture review above is one input to that classification, not the whole of it. This document's own architecture-specific verdict: **no remaining CRITICAL or HIGH architectural/data-integrity defect** as of this phase.
