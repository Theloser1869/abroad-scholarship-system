# FRONTEND API MAP — Phase F01 (designed), implemented F02, extended F03, extended F04

**Status**: §1's conventions are now real, working code — `lib/api/client.ts`
(`apiFetch`/`apiUpload`/`apiDownloadBlob`/`resolveApiUrl`, single-flight refresh, timeout,
error mapping) and `lib/auth/` (login/MFA/refresh/logout). Auth-specific detail (token
strategy, refresh race, session bootstrap sequencing) is documented in
`docs/frontend/FRONTEND_AUTH.md`, not duplicated here. F03 added the first real domain typed-
call layers: `lib/leads/api.ts`, `lib/students/api.ts`, `lib/cases/api.ts`. F04 added
`lib/contracts/`, `lib/payments/`, `lib/assessments/`, `lib/roadmaps/`, `lib/profile-evidence/`,
`lib/writing/`, `lib/lor/`, `lib/documents/` (read-only: `getDocument`/
`requestDocumentDownload` only — F04 integrates document *links*, it does not rebuild the
Document subsystem, F07 scope) — each a thin wrapper over `apiFetch`, per §1's rule that this
file is the only module allowed to call `fetch`, plus matching TanStack Query hooks with scoped
cache invalidation (§7 "Query / cache"). Every other domain in §2's mapping table below remains
F05+ scope.

### F03 backend fix (DEC-09) — owner/student relation summaries

`GET /leads`, `GET /leads/:id`, `GET /cases`, `GET /cases/:id`, `GET /cases/:id/members`
previously returned bare `ownerId`/`studentId` foreign keys with no way to render a display
name without either an N+1 fetch per row or a forbidden full-table client scan. Fixed
backend-side (Prisma `select`-scoped relation summaries — `{ id, username, fullName }` /
`{ id, studentCode, fullName }`, never a bare `include: { owner: true }` which would leak
`passwordHash`) — see `docs/DECISIONS.md` DEC-09. `GET /cases` also gained a `studentId`
query filter (needed for the Student 360 view's "this student's cases" list — reuses the same
list endpoint, no new route). Frontend types: `lib/api/types.ts`'s shared `UserSummary`,
embedded as `Lead.owner` / `Case.owner` / `Case.student` / `CaseMember.user`.

### F04 backend fix (DEC-10) — Contract student relation summary

Same gap as DEC-09, found on `GET /contracts`/`GET /contracts/:id`: bare `studentId`, no way to
render which student a contract belongs to. Fixed identically (`STUDENT_SUMMARY_SELECT` on
`ContractsService.list()`/`getById()` only; `FieldPolicyService.redactContract` made generic
over `T extends Contract` so the added `student` field survives its type signature) — see
`docs/DECISIONS.md` DEC-10. `lib/contracts/types.ts`'s `Contract.student: StudentSummary`
(reuses `lib/cases/types.ts`'s `StudentSummary`, not a duplicate type).

### F04 implementation notes / discrepancies vs. `docs/api/API_CONVENTIONS.md`

Confirmed directly against the live controllers (implementation is source of truth per this
phase's own instruction):

- **Assessment/Roadmap have no bare `PATCH /assessments/:id` / `PATCH /roadmaps/:id`** — the
  convention doc lists one, but every field-level change goes through a dedicated action
  endpoint instead (submit/approve/reject/criteria-upsert for Assessment; submit/approve/
  reject/status for Roadmap).
- **Assessment criterion upsert is `POST /assessments/:id/criteria`** with `area` in the
  request body, not `PUT /assessments/:id/criteria/:area` as the convention doc shows.
- **`GET /writing-artifacts/:id/versions` does not exist** as a separate endpoint — versions
  come embedded in `GET /writing-artifacts/:id`'s own response (`.versions`, sorted desc).
- **All Counseling-domain list endpoints** (`assessments`, `roadmaps`, `roadmaps/:id/
  milestones`, `academic-records`, `test-records`, `competitions`, `research-projects`,
  `activities`, `writing-artifacts`, `letters-of-recommendation`) **return a plain array, never
  `{data, meta}`** — every one is Case-scoped with naturally small row counts; no
  `PaginationControls` is used anywhere in F04's Counseling pages, only in Contracts/Payments
  (which do paginate, matching F03's Lead/Student/Case convention).
- **Milestone `POST .../tasks`/`GET .../tasks`** exist and are gated on `roadmaps:edit` (not a
  separate `tasks:create` check) but were **not built** — Task UI is out of F04 scope (no
  `/tasks` route in F01's map, same precedent as F03's Case Tasks).
- **Milestone dependencies have no list/read endpoint** — only `POST .../dependencies` (add)
  and `DELETE .../dependencies/:dependsOnMilestoneId` (remove). The UI can therefore only
  *add* a dependency (picking from the roadmap's own already-loaded milestone list); *removing*
  one is not reachable from the UI since there is no way to discover which dependencies exist
  without inventing client-side state tracking — documented limitation, not a silent gap.

Source of truth for every convention/shape below: `docs/api/API_CONVENTIONS.md` +
`apps/api/src/**`. Nothing here invents an endpoint, field, or behavior not already
implemented in the backend. The full endpoint list (100+ routes across every domain) already
exists, verbatim and current, in `docs/api/API_CONVENTIONS.md` §11 — this document does not
duplicate it route-by-route (duplication would drift out of sync as the backend evolves).
Instead: §1 covers every cross-cutting convention the frontend must implement once (in
`lib/api/`), and §2 maps each **frontend feature area** to its backend resource(s), auth
requirement, scope model, and response shape, pointing back to API_CONVENTIONS.md §11 for the
exact route list of that resource.

## 1. Cross-cutting conventions (implemented once, in `lib/api/client.ts`)

### 1.1 Authorization header

Every authenticated request: `Authorization: Bearer <access-token>` (JWT, 15 min TTL by
default — `AUTH_ACCESS_TOKEN_TTL_MINUTES`). Issued by `POST /auth/login` (or MFA verify, or
`POST /auth/refresh`). `lib/api/client.ts`'s `apiFetch` attaches this from a single
swappable token-getter (today: a placeholder always returning `null` — see
`FRONTEND_ARCHITECTURE.md` §9); F02 wires it to the real session.

### 1.2 httpOnly refresh cookie

`POST /auth/login`/`refresh`/MFA-verify also set a `refresh_token` cookie
(`httpOnly`, `SameSite: strict`, path `/auth`) — **the frontend never reads or writes this
cookie directly**; it exists purely for `POST /auth/refresh` to pick up automatically. `
apiFetch` sends `credentials: "include"` so the browser forwards it whenever present.
Frontend code must never store a copy of the refresh token itself (e.g. in `localStorage`) —
the cookie is the only copy that should exist client-side.

### 1.3 401 — unauthenticated

No valid/non-revoked session at all. `lib/auth/`'s session bootstrap (F02) should distinguish
this from a real error: on the *initial* app load a 401 from `GET /auth/me` just means
"anonymous visitor," not a crash. On any *subsequent* call, a 401 means the session
expired/was revoked mid-use (logout elsewhere, admin-forced revoke, `AUTH_ACCESS_TOKEN_TTL_
MINUTES` elapsed) — the UI should attempt one `POST /auth/refresh`, and if that also fails,
clear `AuthContext` and redirect to login. (F02 scope — not implemented yet.)

### 1.4 403 — permission denied

The caller's role has no grant on `(resource, action)` at all — a *coarse*, role-level deny,
independent of which record. Render this as a real "not allowed" state (per master context's
required 403 UI state), never a silent empty list — the caller should understand *why*
nothing loaded. `FRONTEND_PERMISSION_MAP.md` lets a page pre-emptively hide an action the
caller's role could never have anyway (better UX — no round-trip just to get denied), but the
403 handling path must still exist for every mutating call, since a page's own
permission-map read can be wrong/stale and the backend is the actual authority
(`frontend_prompts` MASTER_CONTEXT: no client-side authorization decisions).

### 1.5 404 — not found OR out of scope (deliberately indistinguishable)

`docs/security/RBAC_MATRIX.md` §3: a record that doesn't exist and a record that exists but
is outside the caller's scope (not their Case, not their linked Student, ...) return the
**same** `404`, by design (SRS AC-02 non-enumeration — a 403 here would itself leak "this
record exists"). The frontend must render both as one generic "not found" state — it must
never attempt to distinguish them (e.g. by trying a second request, or inferring from a list
view) and must never say something like "you don't have permission to view this" for a 404,
since that phrasing itself would be a distinguishability leak.

List endpoints apply the equivalent scope filter server-side — an out-of-scope row never
appears in a paginated result at all, so a list page needs no special out-of-scope handling,
only the generic empty state.

### 1.6 Error contract

Every non-2xx response (400/401/403/404/409/422/429/500):

```json
{ "error": { "code": "STRING_CODE", "message": "...", "requestId": "...", "details": [...] } }
```

`lib/api/client.ts` parses this into `ApiError { status, code, message, requestId, details }`
— a domain hook/component branches on `error.code` (e.g. `INVALID_CREDENTIALS`,
`ACCOUNT_LOCKED`, `DOCUMENT_ARCHIVED`, `IDEMPOTENCY_KEY_REUSED`, ...), never on `error.message`
(the message is for humans, not program logic, and can be reworded server-side without
notice).

### 1.7 Pagination

Every list endpoint: `?page=1&limit=20&sort=field:asc&search=...` (page-based, `limit` max
100, `sort` whitelisted per endpoint server-side — an unsupported field/direction is
`400 INVALID_SORT`, never silently ignored). Response:

```json
{ "data": [...], "meta": { "page": 1, "limit": 20, "totalItems": 42, "totalPages": 3 } }
```

`lib/api/types.ts` already defines `PaginatedResponse<T>`/`PaginationMeta` for this — every
future list-page hook returns this exact shape, never a bare array (master context:
"pagination/filter server-side khi backend hỗ trợ" — a frontend page must never fetch
everything and paginate client-side once the backend already paginates).

### 1.8 `X-Request-Id`

Echoed on every response (success or error) and included in every error body
(`error.requestId`) and every audit-log row server-side. Worth surfacing in an error toast/
detail ("mã lỗi: <requestId>") so a user can report a specific failure precisely — not
required for F01's scaffold, a UX nicety for whichever phase builds the first real error
surface.

### 1.9 Idempotency

Mutating endpoints marked `@Idempotent()` in API_CONVENTIONS.md §11 (e.g. `POST /students`,
`POST /contracts`, `POST /payments/:id/record`) expect an `Idempotency-Key: <client-uuid>`
header on retries of the *same logical action* (e.g. a double-click or a network-timeout
retry) — same key + same body replays the stored response without re-running the handler;
same key + different body is `409 IDEMPOTENCY_KEY_REUSED`. A future mutation hook for one of
these endpoints should generate one UUID per *user-initiated attempt* (not per HTTP retry —
those should reuse the same key) and never reuse a key across genuinely different actions.

### 1.10 Audit behavior

Purely a backend-side concern (`@Audit('ACTION')` on the relevant routes,
`docs/api/API_CONVENTIONS.md` §7) — the frontend does not need to do anything to make an
action audited, and must never assume an action *wasn't* audited just because the UI didn't
show a confirmation (a denied 401/403 attempt is audited too, `result: 'DENIED'`/`'ERROR'`).
The one frontend-relevant implication: `EXPORT` actions (`GET /students/export`, `/contracts/
export`, `/payments/export`, `/reports/cases/export`) require a mandatory `reason` query
param server-side (SRS 6.21) — any export UI must collect and send a reason, not treat it as
optional.

## 2. Frontend feature → backend resource map

One row per feature area (not per individual route — see the intro). "Scope" is the
`ScopeKind` from `docs/security/RBAC_MATRIX.md` §3 (GLOBAL = every role holding the
permission sees every row; CASE_MEMBER/OWN_STUDENT/OWN_LEAD = narrowed per caller,
server-side, never client-computed). Full route list: API_CONVENTIONS.md §11, same resource
name.

| Feature area | Resource(s) | Scope | Response shape | Mutation semantics |
|---|---|---|---|---|
| Leads | `leads` | `OWN_LEAD` (SALES_MARKETING) / GLOBAL (ED/DM) / NONE (everyone else) | list: paginated; detail: single record | **Implemented F03**: `POST` create (`@Idempotent`), `PATCH` edit, `PATCH .../status` (FSM, `lib/leads/hooks.ts` `useUpdateLeadStatus`), `PATCH .../assign`, `POST .../convert` (`@Idempotent`, creates Student+Case, `LeadConvertDialog` handles the `409 DUPLICATE_STUDENT_CANDIDATES` re-confirmation round trip) |
| Students | `students` | CASE_MEMBER via linked Case (CONSULTANT/DOCUMENT_SPECIALIST) / GLOBAL (ED/DM) / OWN_STUDENT (portal, separate `/portal/*` routes) | list/detail paginated/single, **field-redacted** (`budget`/`budgetCurrency` nulled for roles without finance access — never re-derive this client-side) | **Implemented F03**: `POST` create (`@Idempotent`), `PATCH` edit, `PATCH .../archive`. `GET .../export` (reason required) — **not built** (out of F03 scope, no export UI). Contacts (`GET/POST students/:id/contacts`) — implemented (F03), lives in the `portal` backend module despite being a Student sub-resource. |
| Cases | `cases` | CASE_MEMBER (any member = view; `OWNER` only = manage) / GLOBAL | list/detail | **Implemented F03**: stage/status/close each a dedicated sub-route, never a bare field PATCH; member add/remove/reassign-owner each their own action. Case creation has no bare `POST /cases` — only `POST /students/:id/cases` (`lib/students/api.ts` `createCaseForStudent`, launched from the Student detail page). Case Tasks (`GET /cases/:id/tasks`) exist on the backend but were **not built** in F03 (no `/tasks` route in F01's route map; a dedicated Task feature is later-phase scope) — documented as a known limitation, not a silent gap. |
| Contracts | `contracts` | `CONTRACT_ROLE_SCOPE`: GLOBAL (ED/DM/ADMIN_FINANCE) / OWN_STUDENT (portal) / **NONE** (CONSULTANT/DOCUMENT_SPECIALIST — deliberately does NOT follow Case scope) | list/detail, field-redacted (value/currency/threshold) for roles with NONE scope (defense-in-depth — they're already denied earlier) | **Implemented F04**: full lifecycle `/contracts`, `/contracts/[id]` — submit → approve/reject → send → sign → amendments → status (ACTIVE/COMPLETED/LIQUIDATED/ARCHIVED, linear); `approve` requires EXECUTIVE_DIRECTOR specifically once at/above the contract's snapshotted threshold, surfaced verbatim (`APPROVAL_THRESHOLD_EXCEEDED`) |
| Payments | `payments` | same `CONTRACT_ROLE_SCOPE`, resolved one hop through parent Contract | **no bare list** — always via `GET /contracts/:contractId/payments`, or a single `GET /payments/:id` | **Implemented F04**: `/contracts/[id]/payments` (installment list + create), payment detail/record/refund/waive as a dialog (no standalone `/payments/[id]` route — none mapped in F01). `record`/`refund`/`waive` are separate actions, never a bare edit; overpayment requires an explicit resubmit-with-confirm (`allowOverpayment`), mirroring F03's Lead-convert conflict pattern |
| Tasks | `tasks` | reuses Student/Case `ROLE_SCOPE` + owner-or-case-OWNER manageability | list/detail | **Not built** (F04 or earlier) — no `/tasks` route in F01's map; Milestone's own `.../tasks` sub-endpoints exist but are unused for the same reason (F03/F04 shared limitation) |
| Assessments | `assessments` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `criteria` | **Implemented F04**: `/cases/[caseId]/assessments`, `/assessments/[id]` — version list, criteria upsert (`gap` always server-computed, never recalculated client-side), submit/approve/reject |
| Roadmaps | `roadmaps` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `milestones` | **Implemented F04**: `/cases/[caseId]/roadmaps`, `/roadmaps/[id]` — submit/approve/reject/status, milestone create/edit/status/add-dependency inline on the roadmap detail page (no separate milestone route) |
| Profile evidence (Academic/Test/Competition/Research/Activity) | `profile_evidence` | reuses Student/Case `ROLE_SCOPE` | list per Case per sub-type (5 plain arrays) | **Implemented F04**: `/cases/[caseId]/profile` (tabbed) — create/edit per sub-type, `verify` (Academic/Test/Activity only, gated on `profile_evidence:edit`, not a distinct action), duplicate-test-attempt conflict (`409 DUPLICATE_TEST_ATTEMPT`) surfaced verbatim |
| Writing (Artifact/Version/LOR) | `writing` | reuses Student/Case `ROLE_SCOPE` | list per Case (plain array), detail incl. `versions` | **Implemented F04**: `/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` — status FSM, new-version-only (no content edit endpoint exists), per-version review + Comment-entity-backed feedback (reuses F03's Comment API). LOR tracking is a card on the list page (no dedicated route — F01 never mapped one) |
| Admission master data | `admission_master` (University/Program/ScholarshipMaster) | GLOBAL, permission-gated only (shared catalog, no per-record scope) | list/detail | `create`/`edit`/`verify` ED/DM-only; `verify` is its own action, distinct from `edit` |
| University choices / Applications / Offers / Scholarship applications | `university_choices`, `applications`, `offers`, `scholarship_applications` | reuse Student/Case `ROLE_SCOPE` (Offer resolves one hop through parent Application) | list/detail, ScholarshipApplication field-redacted (`internalNotes`) for STUDENT_PARENT | Application `submit` requires every required checklist item DONE/WAIVED (409 otherwise); Offer `respond` is ACCEPT/DECLINE only |
| Visa / Enrollment | `visa`, `visa_checklist_templates` (GLOBAL master data), `pre_departure`, `enrollment` | reuse Student/Case `ROLE_SCOPE`, both `caseId`-required | list/detail, field-redacted (`internalNotes`) for STUDENT_PARENT | Visa has dedicated `submit`/`appointment`/`interview`/`result` actions, never a bare status PATCH |
| Partners / Commission | `partner`, `partner_programs`, `partner_documents`, `partner_student_links`, `commission_rules`, `commission_transactions` | GLOBAL, permission-gated only — **no Case-membership layer at all**, unlike every domain above | list/detail, Partner field-redacted (`internalNotes`) for DOCUMENT_SPECIALIST | CommissionTransaction has a long dedicated FSM (`confirm-eligibility → calculate → approve → mark-payable → pay`, or `cancel`) — never a bare status PATCH |
| Documents | `documents` | **grant-based, not ScopeKind-based** — GLOBAL roles bypass, everyone else needs an explicit `DocumentAccess` row (VIEW/DOWNLOAD/EDIT/SHARE); download additionally gated on `scanStatus === 'CLEAN'` | single record (no bare list — always reached via an owning record's evidence field) | **Partially implemented F04** — `lib/documents/api.ts`'s `getDocument`/`requestDocumentDownload` + `EvidenceDocumentLink` component (redeems the 2-step signed-URL flow — `GET /documents/:id/download` → `resolveApiUrl` → new-tab navigate to the returned `downloadUrl`, never treated as a permanent link) is the only F04 usage; every `evidenceDocumentId`/`documentId`/`signedDocumentId`/`receiptDocumentId` field across F04's forms is a manual UUID text input (no upload/browse UI — F07 owns the full Document subsystem, F04 instruction §31: "Không xây lại Document subsystem") |
| Notifications | *(self-service, no permission resource)* | `recipientId === caller` always, any authenticated role | list | mark-read only, 404 if not the caller's own |
| Reports | `reports` | `view` (every staff role, further role-narrowed inside the service for executive/manager); `export` ED/DM-only | aggregated, not paginated the same way (dashboard-shaped, not a list) | `cases/export` requires `reason` |
| Admin / Identity — Users | `users` | GLOBAL, SYSTEM_ADMIN (full) / EXECUTIVE_DIRECTOR (`view` only, no `suspend`/`offboard`) | list/detail | `suspend`/`reactivate`/`offboard` SYSTEM_ADMIN-only |
| Admin / Identity — Audit logs | `audit_logs` | GLOBAL, EXECUTIVE_DIRECTOR/SYSTEM_ADMIN only | list | read-only, viewing it is itself audited |
| Admin / Identity — Jobs | `jobs` | GLOBAL, SYSTEM_ADMIN only | list/detail | read-only (background job status observability) |
| Portal (all sub-resources) | `portal` (class-level `access` gate) + the underlying domain resource's own scope, resolved OWN_STUDENT/revocation-aware | see `FRONTEND_ROUTES.md` PORTAL section | list/detail, narrower field set than the staff equivalent (e.g. Task's `blocker`/`qualityScore`/`ownerId` always stripped) | narrow, portal-specific action set only (submit evidence, submit task output/status, respond to nothing financial) — never the full staff mutation surface |

## 3. What F01 does not map

Individual field names/DTO shapes per entity — those belong to the domain phase that
implements each feature, read directly from the real backend response at that time (per
`frontend_prompts` "Không tự tạo API giả"), not guessed in advance and risked going stale
before that phase starts.
