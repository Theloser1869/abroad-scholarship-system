# Closure / Liquidation — Unified Workflow Design

**Status: IMPLEMENTED (2026-08-26).** Implements the client's DEC-06/DEC-07/DEC-08 decisions
(business-remediation task, not a redesign) for GAP-007 / REQ-CASE-014. Supersedes the
"two independent closure mechanisms" finding from `CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md` §E
and the corresponding rows in `CLIENT_ACCEPTANCE_MATRIX.md` / `CLIENT_REQUIREMENTS_GAPS.md`
(GAP-007) / `CLIENT_CLARIFICATION_SIGNOFF.md` (DEC-06/07/08).

## 1. Problem this replaces

Before this remediation, two independent, unsynchronized closure mechanisms existed:

- **Contract-level** (`ContractsService.updateStatus`, ADMIN_FINANCE/HCTH only via
  `contracts:edit`): ACTIVE→COMPLETED checked only outstanding `Payment` rows;
  COMPLETED→LIQUIDATED required only a free-text `closureReason`.
- **Case-level** (`CasesService.close()`, EXECUTIVE_DIRECTOR/DEPARTMENT_MANAGER/CONSULTANT
  via `cases:close` — **not** ADMIN_FINANCE, which had zero `cases:*` grant): thorough
  (open tasks, debt, visa, enrollment, pre-departure) but unreachable by HCTH, the role the
  client's Excel names as closure owner. No liquidation concept at all. No document-handover
  check existed anywhere.

## 2. Client decisions implemented

### DEC-06 — Closure owner

Chosen option: **A — one unified workflow.**

- **HCTH (`ADMIN_FINANCE`)** is the sole standard executor of Hoàn tất/Đóng hồ sơ/Thanh lý.
- **EXECUTIVE_DIRECTOR / DEPARTMENT_MANAGER** may exercise an **audited exception**
  (`overrideReason` required on every mutating action; audited as `OVERRIDE_USED`) —
  never a parallel, weaker path. Client's own words: *"Nếu cần exception: phải có
  authorized role, phải có reason, phải audit, không được là bypass âm thầm."*
- **CONSULTANT** (the case's OWNER member) may only **request** closure — advisory, never
  a precondition (see §5, Implementation Assumption #1).
- The old independent Contract-level path is retired: `ContractsService.updateStatus()`
  rejects `COMPLETED`/`LIQUIDATED` with `409 USE_UNIFIED_CLOSURE_WORKFLOW` once a Case is
  linked (always true in practice — `sign()` requires and sets that link before ACTIVE is
  reachable). The old `PATCH /cases/:id/close` route and `cases:close` permission are
  deleted outright — client's own words: *"Không được duy trì hai closure paths có business
  rule khác nhau."*

### DEC-07 — Six mandatory closure preconditions

All six are mandatory; Closure cannot complete unless every item is PASS (Visa may
additionally be NOT_APPLICABLE — the only item allowed a third state):

| Item | PASS when | NOT_APPLICABLE |
|---|---|---|
| Công nợ (Debt) | No PENDING/PARTIALLY_PAID/OVERDUE Payment on the linked Contract | never |
| Công việc còn mở (Open Tasks) | No Task in NOT_STARTED/IN_PROGRESS/BLOCKED | never |
| Visa | No Visa in a non-terminal status | zero Visa rows exist |
| Xác nhận nhập học (Enrollment) | A CONFIRMED Enrollment exists | zero Application rows exist |
| Checklist trước khi bay (Pre-departure) | Every required item is DONE/WAIVED | zero required items exist |
| **Bàn giao tài liệu (Document Handover)** | `ClosureHandoverRecord.status = COMPLETED` | **never** — must be explicitly confirmed |

Document Handover is the item GAP-007 identified as checked by neither old path. It is
deliberately never auto-inferred as NOT_APPLICABLE, per the client's explicit instruction —
even a case with no other activity at all must have handover confirmed before closing.

### DEC-08 — Two-party liquidation confirmation

Chosen option: **A — authenticated two-party confirmation**, replacing the old free-text
`Contract.closureReason` liquidation note.

- **Company side**: an authenticated staff actor (HCTH standard, or ED/DM override) confirms
  via `POST /cases/:id/closure/liquidation/confirm-company`.
- **Student/Parent side**: the linked Student (self) or an ACTIVE linked Parent confirms via
  `POST /portal/students/:id/closure/liquidation/confirm` — resolved server-side via the
  existing `ScopePolicyService.assertStudentAccessible` (revocation-aware), never
  client-supplied.
- Each side records its own actor id + timestamp independently — never one event
  representing both.
- Once both sides have confirmed, `LiquidationConfirmation.status → LIQUIDATED` and, if the
  linked Contract is `COMPLETED`, it syncs to `LIQUIDATED` in the same transaction. From
  that point the record is **immutable** — any further confirmation attempt from either side
  is rejected with `409 ALREADY_LIQUIDATED`. No e-signature integration was built (explicitly
  out of scope for this remediation per the client's own instruction).

## 3. Final workflow

Case status machine is **unchanged** (`CaseStatus`: OPEN/ACTIVE/ON_HOLD/COMPLETED/CLOSED/
ARCHIVED) — no new enum values were needed:

```
ACTIVE/ON_HOLD/COMPLETED (Case)
        │  (advisory) Consultant requests closure — internal Comment, never a gate
        ▼
   [Closure Checklist — 6 items, computed live, GET /cases/:id/closure]
        │  HCTH confirms Document Handover — POST .../closure/handover
        │  HCTH executes Đóng hồ sơ once all items PASS/N-A — POST .../closure/close
        ▼
Case → CLOSED  +  linked ACTIVE Contract → COMPLETED   (one transaction)
        │
        │  Company confirms — POST .../closure/liquidation/confirm-company
        │  Student/Parent confirms — POST /portal/students/:id/closure/liquidation/confirm
        ▼
LiquidationConfirmation → LIQUIDATED  +  linked COMPLETED Contract → LIQUIDATED (one transaction, immutable)
        │
        ▼
ARCHIVED (existing, unrelated generic PATCH /cases/:id/status and /contracts/:id/status — unchanged)
```

## 4. Roles / RBAC

New resource `case-closure`, actions `view | request | execute`:

| Role | view | request | execute |
|---|---|---|---|
| ADMIN_FINANCE (HCTH) | ✓ | — | ✓ (standard, no `overrideReason` needed) |
| EXECUTIVE_DIRECTOR | ✓ | — | ✓ (override, `overrideReason` required) |
| DEPARTMENT_MANAGER | ✓ | — | ✓ (override, `overrideReason` required) |
| CONSULTANT | ✓ (case-owner) | ✓ (case-owner) | — |
| all others | — | — | — |

`ClosureService` does its own narrow authorization (`assertClosureAccessible`) rather than
reusing `ScopePolicyService.assertCaseAccessible` — see §5, Implementation Assumption #3.

## 5. Implementation assumptions (client did not specify — not to be read as requirements)

The client's DEC-06/07/08 spec (and `CLIENT_CLARIFICATION_SIGNOFF.md`) left the following
gaps, filled in by engineering judgment. None conflict with the client's own text; each is
flagged so the client can correct it if the assumption is wrong.

1. **"Request closure" is advisory, not a hard gate.** The client's workflow diagram draws
   Consultant→HCTH as sequential, but nowhere states a request is a precondition for HCTH
   acting, and the client's own test list never tests such a block. Implemented as a
   `Comment` (`entityType: 'Case'`, `visibility: 'internal'`), visible to HCTH on the Case
   timeline, never enforced server-side.
2. **"Hoàn tất" + "Đóng hồ sơ" collapse into one action/endpoint.** The client's diagram
   draws `CLOSURE_READY → HCTH CLOSES CASE → CLOSED/COMPLETED` as a single arrow. One
   transaction (Case→CLOSED, linked ACTIVE Contract→COMPLETED) is what guarantees the two
   states stay synchronized — the alternative (two separate calls) would reopen a narrower
   version of the exact sync gap this remediation exists to close.
3. **HCTH gets a new, narrow `case-closure:*` permission, not broadened general Case
   access.** Widening `ADMIN_FINANCE`'s existing `cases:*` scope (`NONE`) would let HCTH
   browse arbitrary case data (tasks, roadmap, academic records) — well beyond "Closure is
   its entire domain." This is the more conservative reading, flagged in case the client
   actually wants HCTH to see full case detail.
4. **Old routes are hard-rejected (409), not silently left reachable.** `PATCH
   /cases/:id/close` and the `cases:close` permission are deleted outright;
   `ContractsService.updateStatus()` keeps its route but rejects `COMPLETED`/`LIQUIDATED`
   with `409 USE_UNIFIED_CLOSURE_WORKFLOW` once a Case is linked.

## 6. Data model (additive migration `20260826015443_closure_liquidation_unification`)

- `ClosureHandoverRecord` (1:1 with Case) — `status: PENDING|COMPLETED`, `handedOverAt`,
  `handedOverById`, `recipientName`, `notes`.
- `LiquidationConfirmation` (1:1 with Case) — `status: PENDING|LIQUIDATED`,
  `companyConfirmedAt/ById`, `studentParentConfirmedAt/ById`, `liquidatedAt`.

No changes to `CaseStatus`/`ContractStatus` enums.

## 7. Audit

Every mutating action is `@Audit`-decorated (`AuditInterceptor`, unchanged pattern) with an
`event` field in `metadata`: `CLOSURE_REQUESTED`, `CLOSURE_CHECKED` (handover), `ARCHIVE`
action for close (`CLOSURE_COMPLETED` or `OVERRIDE_USED` + `overrideReason` in metadata),
`APPROVE` action for liquidation confirmations (`LIQUIDATION_COMPANY_CONFIRMED` /
`LIQUIDATION_STUDENT_PARENT_CONFIRMED`).

## 8. Files touched (representative, not exhaustive)

**Backend**: `database/schema.prisma` (new models), `apps/api/src/modules/case-management/closure/*`
(new module — service/controller/DTOs), `apps/api/src/modules/case-management/cases/{cases.service,cases.controller,cases.module}.ts`
(`close()` removed), `apps/api/src/modules/commercial/contracts/contracts.service.ts`
(`updateStatus()` redirect guard, `getById()` now returns `caseId`), `apps/api/src/modules/case-management/tasks/tasks.service.ts`
(`countOpenForCase`), `apps/api/src/modules/visa/visa-status/visa-status.service.ts`
(`getClosureStatus`), `apps/api/src/modules/portal/portal/{portal.service,portal.controller,portal.module}.ts`,
`database/seeds/seed.ts` (RBAC).

**Frontend**: `apps/web/lib/closure/*` (new), `apps/web/app/(staff)/cases/[id]/closure/page.tsx`
(new, replaces `CaseCloseDialog`), `apps/web/app/(portal)/portal/students/[id]/closure/page.tsx`
(new), `apps/web/app/(staff)/contracts/[id]/closure/page.tsx` (rewritten, read-only + link),
`apps/web/lib/permissions/rbac-data.ts`, `apps/web/components/crm/status-badge.tsx`,
`apps/web/lib/api/error-messages.ts`.

## 9. Tests

- Backend unit: `apps/api/src/modules/case-management/closure/closure.service.spec.ts` (23 tests).
- Backend e2e: `apps/api/test/case-closure.e2e-spec.ts` (16 tests, new — role gating, advisory
  request, checklist visibility, two-party liquidation, immutability, unlinked-parent denial);
  updates to `pre-departure-enrollment-closure.e2e-spec.ts`, `case-management.e2e-spec.ts`,
  `contracts.e2e-spec.ts`, `payments.e2e-spec.ts`.
- Frontend: `apps/web/app/(staff)/cases/[id]/closure/page.test.tsx` (new, 6 tests).
- Full regression green: backend 209 unit / 534 of 535 e2e (1 pre-existing, unrelated,
  timing-dependent flake in `r2-storage-provider.e2e-spec.ts`, confirmed unaffected by this
  change — passes cleanly in isolation); frontend 317/317.
