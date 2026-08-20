# Security Test Report — Phase 13

Scope: `13-qa/02_SECURITY_REVIEW.md` checklist, executed against the full `apps/api/src` codebase and cross-checked against `docs/security/RBAC_MATRIX.md`, `docs/security/AUTH_MODEL.md`, and the SRS's security sections (§3, §12, §13). Every finding below was verified by reading the actual service implementation, not inferred from route names or documentation claims. All roles tested both ALLOW and DENY paths, not just happy-path.

**Result: CRITICAL findings = 0 (1 found, fixed). HIGH findings = 0 (3 found, fixed). MEDIUM findings = 2 (1 fixed, 1 deferred with documented reason). LOW findings = 3 (documented, no fix required).**

---

## 1. IDOR (Insecure Direct Object Reference)

| Check | Result |
|---|---|
| `GET /students/:id`, `GET /cases/:id`, and every other single-record read | PASS — 404 (not 403) for out-of-scope records, non-enumerating per SRS AC-02, verified across `rbac.e2e-spec.ts` |
| `GET /students?search=...` combined with `OWN_STUDENT` scope | **CRITICAL (fixed)** — see §2 below |
| Document IDOR via forged `ownerId`/`ownerEntity` on upload | PASS — these fields are metadata only; access is grant-table-driven, never derived from them |
| Signed download-URL token scoping (documentId + principalId) | PASS — a token issued to one principal is rejected for another, even before expiry (`documents-platform.e2e-spec.ts`) |
| Cross-case / cross-partner / cross-department record access | PASS — verified via `rbac.e2e-spec.ts`, `partners.e2e-spec.ts` cross-role DENY cases |
| Parent → unlinked child; revoked parent → same-token immediate DENY | PASS — `portal.e2e-spec.ts` proves revocation is `portalStatus`-based (not a null-check) and takes effect on the very next request using the *same already-issued token*, no re-login required |

## 2. Broken Access Control — CRITICAL (fixed)

**Finding**: `StudentsService.list` (`apps/api/src/modules/case-management/students/students.service.ts`) built its Prisma `where` clause by flat-spreading `ScopePolicyService.studentListFilter(principal)` (which returns a top-level `OR` key for `OWN_STUDENT` scope) together with the `?search=` query's own top-level `OR` key. The second `OR` silently **overwrote** the first instead of narrowing it.

**Impact**: STUDENT_PARENT holds `students:view` (used directly, not only through the Portal). `GET /students?search=<any substring>` as this role returned **every non-archived student in the system** — full name, email, phone, target country/major/intake, student code — regardless of case membership or portal linkage. `GET /students/:id` was unaffected (different code path, correctly scoped).

**Fix**: Combined the scope filter and search filter under a Prisma `AND` array, which composes safely regardless of each fragment's internal shape (`students.service.ts`).

**Regression test**: `apps/api/test/students.e2e-spec.ts` — "never leaks an unlinked student to a STUDENT_PARENT via ?search=, even with a matching substring" — asserts both the unscoped list and the `?search=` list are confined to the linked child only.

**Scope of the audit**: all 9 services reading `query.search` project-wide were checked; only this one instance of the collision pattern was found (every other scope filter uses a non-colliding top-level key).

## 3. Privilege Escalation (horizontal + vertical)

| Check | Result |
|---|---|
| Consultant B (not a case member) writing to Consultant A's case | PASS — 404, cross-case isolation on writes (`case-management.e2e-spec.ts`) |
| COLLABORATOR (not OWNER) managing case membership | PASS — 403 `PERMISSION_DENIED` |
| Any staff role attempting an admin (`jobs:view`, `audit_logs:view`, role/permission management) action | PASS — SYSTEM_ADMIN-only, verified |
| Visa evidence document access — Consultant vs. Document Specialist | **HIGH (fixed)** — see §9 |
| Document download for GLOBAL-scope role with no personal grant | **HIGH (fixed, functional not privilege-escalation)** — see §9 |
| Guard-level permission denial produces no audit trail | **HIGH (fixed)** — see §11 |

## 4. Mass Assignment

Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` (`apps/api/src/main.ts`) strips/rejects any unknown property on every request. Spot-checked the most sensitive update DTOs (Contract, Payment, Document, Case status, Task status, User role assignment): server-derived fields (`id`, `status` enums, `ownerId`/`createdBy`, `scanStatus`, `checksumSha256`, `fileReference`) are never present as assignable DTO properties — status changes route through dedicated, transition-table-gated action endpoints, never a generic PATCH. **No finding.**

## 5. SQL Injection

Only raw-SQL call sites in the entire codebase: `IdGeneratorService.nextSequenceValue` (`apps/api/src/common/id/id-generator.service.ts`), using `$executeRawUnsafe`/`$queryRawUnsafe` with positional `$1/$2/$3` bind parameters — no string interpolation of variable content into SQL text; `prefix` is always a hardcoded literal, `bucket` is a DTO-validated year/country code. Despite the "Unsafe" method name, this is properly parameterized. **No finding.**

## 6. XSS

This repository is API-only (`apps/`) — no rendered-HTML frontend exists to attack. The only place user-controlled text reaches anything resembling markup is `LogEmailProvider`, which logs plain subject/body text, never interpolates into HTML. Noted for the record: a future frontend consuming this API must escape on render — not fixable/testable in this repository. **No finding (not applicable to current scope).**

## 7. CSRF

Primary auth is a Bearer JWT in the `Authorization` header — cross-site requests cannot forge this (browsers don't auto-attach it). The one cookie in use (the refresh token) is `httpOnly, sameSite: 'strict', path: '/auth'`, which already blocks cross-site delivery. **No finding.**

## 8. File Upload Abuse / Path Traversal / SSRF

| Check | Result |
|---|---|
| MIME allowlist + magic-byte + extension + size-cap validation, wired at the only upload call site | PASS |
| Malware scan gate blocks download until `scanStatus === CLEAN`, for everyone including uploader/GLOBAL roles | PASS |
| Storage keys are server-generated UUIDs, never derived from client filenames; `assertSafeKey()` rejects malformed keys before path construction | PASS — the only filesystem-path-construction call site in the codebase is `LocalFilesystemStorageProvider` |
| SSRF via outbound HTTP with client/partner-supplied URL | PASS — no outbound HTTP call (`fetch`/`axios`/`http(s).request`) exists anywhere in `apps/api/src`; `ExternalSchoolDataProvider`'s only implementation is a no-op |

## 9. Document Security (Phase 12 subsystem re-audit)

| Check | Result |
|---|---|
| Arbitrary/guessed document ID | PASS — 404, non-enumerating |
| Changed ownerId/studentId/caseId on upload | PASS — metadata only, grants no access |
| Expired / reused / tampered signed URL | PASS — TTL enforced, constant-time signature comparison, live grant + live scan status re-checked on every use |
| Two-step download-flow authorization parity (step 1 vs step 2) | **HIGH (fixed)**. `requestDownload` (step 1) lets GLOBAL-scope roles (Executive Director, Department Manager) through without requiring a `DocumentAccess` row; `downloadByToken` (step 2) re-checked only a raw grant-table row, regardless of scope — so a GLOBAL-scope caller with no personal grant got a valid `downloadUrl` from step 1 and then a 403 on step 2 for any document they didn't personally upload/get shared. This is over-restrictive (breaks legitimate access), not a leak — still fixed as a HIGH "major workflow broken" per the release gate. **Fix**: `downloadByToken` now re-derives the same GLOBAL bypass from the token's `principalId` by loading the requester's role. **Test**: `documents-platform.e2e-spec.ts` "a GLOBAL-scope role (director) can complete both download steps for a document with no personal grant." |
| Consultant access to visa-sensitive evidence documents | **HIGH (fixed)**. SRS §13 gives Consultant only "Xem hạn chế" (restricted view) on Visa evidence, vs. full access for Document Specialist/GĐĐH/Trưởng phòng; §6.14 calls for visa-sensitive documents to carry their own, separate download permission. Every Visa evidence-linking call site used the same uniform `grantCaseAccess` (VIEW+DOWNLOAD to every case member) as every other evidence type, over-granting Consultant. **Fix**: added a `viewOnlyForRoles` option to `DocumentsService.grantCaseAccess`, applied only at Visa's 4 evidence-linking call sites (`visas.service.ts`, `visa-checklist.service.ts`); every other evidence-bearing module is unaffected. The document's uploader always keeps full access regardless of role (a separate, pre-existing grant path). **Test**: `visa.e2e-spec.ts` "a Consultant case member gets view-only access to visa evidence they did not upload; the uploader keeps full access." |
| Malicious file (EICAR test signature) | PASS — flagged INFECTED, permanently undownloadable, even for the uploader |
| MIME mismatch / oversized upload | PASS — rejected before storage |
| Public URL exposure | PASS — no permanent/public URL ever stored or returned; every response carries only the short-lived signed-token path |
| Archived document / previous-version access | PASS — versioning never overwrites; grants copy forward; editing an archived document is rejected |
| Checksum verification | PARTIALLY IMPLEMENTED — verified at upload/version-create, never re-verified at download. **Deferred**, see `docs/ASSUMPTIONS.md` ASM-58 (not a live vulnerability with the current local-filesystem provider, whose only write path is the upload flow itself). |

## 10. API Security Review

Reviewed every route in `admin`, `export`, `documents`, `portal`, `webhooks`, `jobs`, `reports`, `contract/payment`, and `commission` controllers for: missing authentication, missing authorization, client-controlled ownership fields, insecure status updates, excessive data exposure, missing pagination. **No additional finding beyond §2/§9/§11** — every mutating route requires both authentication and a specific `@RequirePermission`, status transitions are FSM-gated server-side, and list endpoints are paginated with a `DEFAULT_PAGE_SIZE` cap.

## 11. Audit Review — HIGH (fixed)

**Finding**: NestJS runs Guards strictly before Interceptors. `AuthGuard`'s permission-denial (`ForbiddenException` on a missing `@RequirePermission` grant) never reached `AuditInterceptor`'s catch-and-write-DENIED path — only denials thrown *inside* a handler body (service-level scope/ownership checks, which run after the guard passes) were ever audited. This contradicted the SRS's blanket audit rule and AC-13 ("mọi export thành công/thất bại đều có audit").

**Fix**: `AuthGuard` now writes the same DENIED-shaped `AuditLog` row itself, for any `@Audit`-decorated route, before throwing the 403 (`apps/api/src/common/guards/auth.guard.ts`).

**Regression test**: `apps/api/test/audit.e2e-spec.ts` — "audits a guard-level 403 (role lacks the permission entirely), not just service-level scope denials" — exercises Sales/Marketing (zero `students` grant at all) against `PATCH /students/:id/archive` and confirms a DENIED row is written.

## 12. Background Job / Integration Security

All 6 registered job processors take only an opaque ID from their payload and re-fetch fresh state from the database before acting — no job trusts payload content for a business decision, and none constructs a synthetic elevated principal to bypass RBAC on a principal-gated service method. **No finding.**

### Webhook forgery/replay — MEDIUM (fixed)

**Finding**: `WebhooksService.recordEvent` recorded the `(source, eventId)` uniqueness row before signature validation (correct — even invalid attempts must be auditable), but this meant a **forged** delivery that guessed/intercepted an `eventId` ahead of the real one permanently occupied that slot as `REJECTED`. The legitimate provider's later, correctly-signed delivery under the same `eventId` was then treated as a silent duplicate and never marked `PROCESSED`.

**Fix**: `recordEvent` now "upgrades" a previously-invalid row in place the first time a valid signature actually arrives for that `eventId`, rather than treating it as a permanent duplicate. A genuinely already-valid event is still correctly deduplicated (no double-processing).

**Regression test**: `apps/api/test/webhooks.e2e-spec.ts` — "a forged delivery under a guessed eventId never blocks the later legitimately-signed delivery of the same event."

### General API rate-limiting — MEDIUM (deferred)

No rate limiter exists beyond login's own account-lockout mechanism. See `docs/ASSUMPTIONS.md` ASM-56 for the deferral reasoning (new architectural surface + real regression risk against the existing e2e suite; the one SRS-named brute-force target, login, already has real protection).

## 13. Reporting / Export Security

| Check | Result |
|---|---|
| Dashboard/export scope matches list-endpoint scope (no "export all, filter client-side") | PASS — `exportCases` uses the same `ScopePolicyService.caseListFilter` every Case list endpoint uses |
| Field-level restrictions carried into exports | PASS — no export endpoint bypasses `FieldPolicyService` redaction |
| Export reason/row-count/fields/actor logging | PASS |
| Cross-case/cross-student/finance/commission export leakage | PASS — no finding |

## Findings summary

| # | Severity | Area | Status |
|---|---|---|---|
| 1 | CRITICAL | Student list `?search=` + `OWN_STUDENT` scope collision (IDOR) | **Fixed**, regression test added |
| 2 | HIGH | Document download step-1/step-2 GLOBAL-scope authorization mismatch | **Fixed**, regression test added |
| 3 | HIGH | Consultant over-granted full access to visa-sensitive evidence documents | **Fixed**, regression test added |
| 4 | HIGH | Guard-level permission denials never audited | **Fixed**, regression test added |
| 5 | MEDIUM | Webhook forged-delivery slot-squatting blocks legitimate replay | **Fixed**, regression test added |
| 6 | MEDIUM | No general API rate-limiting beyond login | Deferred — `docs/ASSUMPTIONS.md` ASM-56 |
| 7 | LOW | Document checksum not re-verified at download time | Deferred — ASM-58 |
| 8 | LOW | LOR field-redaction correct but untested by e2e | Deferred (test-gap only) — ASM-59 |
| 9 | LOW | Concurrent-request race on "one active Case per Student" | Deferred — ASM-57 |

**Release gate**: CRITICAL findings = 0. HIGH findings = 0. All fixes carry a regression test; full regression suite re-run green after fixes (see `docs/phase-status/PHASE_13.md`).
