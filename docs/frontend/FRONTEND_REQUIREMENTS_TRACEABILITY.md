# FRONTEND REQUIREMENTS TRACEABILITY — Phase F10

Cross-checks every frontend-relevant row of `docs/REQUIREMENTS_TRACEABILITY.md` (the
backend's own Phase 13 matrix) against the actual `apps/web` implementation: does the
frontend correctly surface, respect, and never bypass what the backend enforces? Classified
per the same convention as the backend matrix: **IMPLEMENTED** (built, correctly wired, and
either automated-test- or live-verified), **PARTIAL** (built but a named sub-case missing),
**NOT IMPLEMENTED**, **NOT APPLICABLE** (a backend-only requirement with no frontend surface
at all). Method: read the actual frontend source for each row, not assumed from route
existence — and for the highest-risk rows, re-verified live this phase (see
`FRONTEND_UAT_REPORT.md`/`FRONTEND_SECURITY_REPORT.md`).

## 1. Identity, RBAC, Security (cross-cutting)

| Backend requirement | Frontend row | Classification | Evidence |
|---|---|---|---|
| Role × sensitive-data matrix (§13) | `FieldPolicyService` redactions rendered as-is, never reconstructed | IMPLEMENTED | `FRONTEND_SECURITY_REPORT.md` §8; unchanged since F04–F08, spot-re-verified |
| Server-side authorization, deny-by-default | Frontend never invents a client-side allow — `rbac-data.ts` is UX-only, every real decision comes from the backend response | IMPLEMENTED | `docs/frontend/FRONTEND_AUTH.md` §8/§9; live-confirmed this phase (403/404 always came from the real backend, never a frontend-only gate silently "denying" without a request) |
| `?search=` scope-collision IDOR (backend CRITICAL fix, Phase 13) | Frontend's search inputs (`SearchInput`, F09) pass the typed value straight through as a query param — no frontend logic could have caused or masked this backend bug, and none does for any of the other 8 `query.search`-using list pages | NOT APPLICABLE (backend-only defect, already fixed backend-side; frontend never duplicates or re-implements scope filtering) | Grepped `apps/web/lib/*/api.ts` for any client-side result filtering: none found — lists render exactly what the backend returns |
| Portal parent-child scope (ALLOW own, DENY unlinked, DENY revoked) | `PortalStudentShell`'s single 404-non-enumerating gate | IMPLEMENTED | Live-verified this phase — `FRONTEND_UAT_REPORT.md` STUDENT_PARENT section |
| Document IDOR (ownerId/ownerEntity grants no extra access) | Frontend never sends a client-chosen `ownerId` for access purposes — only as upload metadata | IMPLEMENTED | Static read, unchanged since F07 |
| Offboarding/session revocation takes effect immediately | `AuthContext`'s `onSessionExpired` listener + the single-flight refresh (F02) | IMPLEMENTED | Static read; live logout-invalidation re-confirmed this phase |
| Login lockout / MFA | `LoginForm`'s MFA-challenge step, lockout error surfaced verbatim via `crmErrorMessage` | IMPLEMENTED | Unchanged since F02 |
| Rate limiting beyond login | No frontend-side throttling exists or is needed — deferred backend-side (ASM-56) | NOT APPLICABLE | Backend-only deferral, no frontend surface |
| No hard-coded secrets / plaintext logging | Grepped this phase: zero `console.log`, zero hard-coded credential/URL | IMPLEMENTED | `FRONTEND_SECURITY_REPORT.md` §11/§12 |
| Audit trail for guard-level denials (Phase 13 fix) | Frontend has no audit-log UI of its own to surface this from — the fix is entirely backend-side and transparent to the frontend | NOT APPLICABLE | Backend-only |

## 2. Lead / Student / Case / Contract / Payment / Task

| Backend requirement | Frontend row | Classification | Evidence |
|---|---|---|---|
| Lead→Contract auto Student+Case (AC-01) | `LeadConvertDialog` → `POST /leads/:id/convert`, navigates to the resulting case | IMPLEMENTED | Unchanged since F03 |
| Lead/Case/Contract FSM (§9) | Every status-transition action gated by `can(resource,action)` + backend response; no client-side transition-table duplication | IMPLEMENTED | Static read — no frontend FSM logic found anywhere, matches Master Context's "Frontend không được tự tạo business state machine" |
| Contract monetary-threshold approval routing (ED-only above threshold) | `ContractDetail` shows the approve action to any `contracts:approve` holder; the backend's `assertApproverAllowed` narrowing is the real gate — frontend correctly does NOT try to pre-compute the threshold client-side | IMPLEMENTED | Static read (no threshold constant duplicated in `apps/web`); live-confirmed ADMIN_FINANCE (no `approve` grant at all) sees zero approve button |
| Case-owner reassignment (Phase 13 new endpoint) | `POST /cases/:id/reassign-owner` wired from F03's case member management UI | IMPLEMENTED (confirmed present in `lib/cases/api.ts`) | Static read |
| ID formats (HS/HD/CASE/TASK/... incl. Phase-13-added `competitionCode`/`researchCode`) | Rendered as opaque strings wherever the backend returns them — no frontend format validation/generation | IMPLEMENTED (trivially — frontend never generates ids) | Static read |
| Single source of truth: outstanding payment / task overdue | Frontend renders `isOverdue`/`outstandingAmount` fields as returned, never recomputes | IMPLEMENTED | Unchanged since F04/F06 |

## 3. Counseling / Profile

| Backend requirement | Frontend row | Classification | Evidence |
|---|---|---|---|
| Assessment/Roadmap versioning, approved-immutable | Frontend shows version history read-only, edit actions gated by status + permission | IMPLEMENTED | Unchanged since F04 |
| LOR internal-notes/contact redaction from Student/Parent | Rendered exactly as returned; STUDENT_PARENT never sees `contactEmail`/`contactPhone`/`internalNotes` fields because the backend omits them | IMPLEMENTED | Static read — matches `FieldPolicyService.redactLor` |
| Writing version append-only | `WritingArtifactFormDialog`/version dialogs create new versions, never a PATCH-in-place on a submitted version | IMPLEMENTED | Unchanged since F04 |

## 4. Admission / Visa

| Backend requirement | Frontend row | Classification | Evidence |
|---|---|---|---|
| University/Program/ScholarshipMaster curation (ED/DM-only edit) | Edit/verify actions gated correctly; CONSULTANT/DOCUMENT_SPECIALIST see view-only | IMPLEMENTED | Unchanged since F05 |
| Application checklist gate before submit | `ApplicationDetail`'s submit action reflects the backend's own precondition (a 409/422 on an incomplete checklist is surfaced via `crmErrorMessage`, never pre-validated client-side to hide the button entirely) | IMPLEMENTED | Static read |
| Offer multi-version, current-offer distinct from history | `ApplicationOffersContent` (F05, route-renamed in F09) shows full history with the current offer highlighted, never derived from "latest date" | IMPLEMENTED | Static read, confirmed unchanged post-F09-rename |
| Visa evidence Consultant view-only-not-download (Phase 13 HIGH backend fix) | Frontend's `EvidenceDocumentLink` download button is gated purely on the backend's own grant (`documents:download` permission + a real `DocumentAccess` row) — the frontend has no independent knowledge of `viewOnlyForRoles`, so a Consultant who lacks a DOWNLOAD grant on a specific visa-evidence document simply gets a 403 if they somehow triggered a download call, and the button itself would only render given `can("documents","download")` which is still `true` for CONSULTANT at the resource level (the restriction is per-document-grant, not per-role-globally) | PARTIAL — the frontend cannot pre-emptively hide a download button only for THIS specific restricted document (it has no signal distinguishing "you have DOWNLOAD" from "you have VIEW-only" ahead of attempting it), so a Consultant would see a download button that then correctly 403s server-side rather than being hidden proactively. **Not a security gap** (backend still correctly denies), but a UX rough edge: no distinct frontend affordance for "view-only" vs. "downloadable" evidence. Not previously documented anywhere in F06–F09. | Static read of `evidence-document-link.tsx` + `docs/security/RBAC_MATRIX.md` §5's Visa-evidence row; new finding this phase, recorded as ASM-worthy but not fixed (would require a new backend response field indicating grant type, out of F10's zero-backend-changes-preferred scope) |

## 5. Partner / Document / Notification / Reporting

| Backend requirement | Frontend row | Classification | Evidence |
|---|---|---|---|
| Document metadata-only, no public URL, signed short-lived URL | Two-step download flow, `resolveApiUrl` + `window.open(...,"noopener,noreferrer")` | IMPLEMENTED | `FRONTEND_SECURITY_REPORT.md` §9 |
| Document download step-1/step-2 GLOBAL-scope parity (Phase 13 HIGH backend fix) | Frontend calls both steps identically regardless of caller role — transparent to this fix | NOT APPLICABLE | Backend-only |
| Malware scan gates download (CLEAN-only) | `document.scanStatus === "CLEAN"` checked before rendering the download control | IMPLEMENTED | Unchanged since F07, re-confirmed via `documents/[id]/page.tsx` this phase |
| Reminder cadence / no sensitive data in email body | No frontend surface (backend/job-only) | NOT APPLICABLE | — |
| Executive dashboard workload/deadlines (Phase 13 fix — previously missing fields) | `Dashboard`'s executive view renders whatever `GET /reports/executive` returns — the Phase 13 backend fix (adding `workload`/`deadlines`) required **no frontend change** since the page was already rendering the full response shape defensively (no field allowlist that would have silently dropped the new fields) | IMPLEMENTED | Live-confirmed this phase — ED dashboard shows KPI cards including overdue-tasks/upcoming-deadlines counts |
| Export scope matches list scope, field redaction carried into export | Export UI passes through the same query params as the underlying list view, no client-side field selection | IMPLEMENTED (not independently re-tested live this phase — see `FRONTEND_UAT_REPORT.md`) | Static read |

## Summary

| Domain | Rows reviewed | Implemented | Partial | Not Implemented | Not Applicable |
|---|---|---|---|---|---|
| Identity/RBAC/Security | 10 | 7 | 0 | 0 | 3 |
| Lead/Student/Case/Contract/Payment/Task | 6 | 6 | 0 | 0 | 0 |
| Counseling/Profile | 3 | 3 | 0 | 0 | 0 |
| Admission/Visa | 4 | 3 | 1 | 0 | 0 |
| Partner/Document/Notification/Reporting | 5 | 3 | 0 | 0 | 2 |
| **Total** | **28** | **22** | **1** | **0** | **5** |

**No frontend-relevant requirement is NOT IMPLEMENTED.** One PARTIAL row found this phase
(Visa-evidence view-only-vs-downloadable has no distinct frontend affordance — a real, newly
discovered UX gap, not a regression, not a security issue since the backend still correctly
enforces the restriction on attempt). Not fixed this phase — the minimal correct fix would
require a new backend response field (grant type) to let the frontend distinguish the two
states ahead of a download attempt, which is a backend contract change outside F10's
"prefer zero backend changes" scope; recorded here for a future phase to pick up deliberately.
