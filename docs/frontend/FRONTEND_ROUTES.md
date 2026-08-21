# FRONTEND ROUTES — Phase F01 (routing plan), updated F02 (auth routes), F03 (CRM routes), F04 (Commercial + Profile/Counseling routes)

Every route below maps to a real backend endpoint from `docs/api/API_CONVENTIONS.md` §11 (the
authoritative endpoint list — nothing here invents a backend route that doesn't exist). Column
"Backend" cites the primary endpoint(s) the route's initial data load calls; a page frequently
calls several more (sub-resources, actions) once it exists — those are enumerated in
`FRONTEND_API_MAP.md`, not repeated here. "Phase" is the frontend phase expected to build the
route (per `frontend_prompts/docs/FRONTEND_PHASE_MAP.md`).

**Status**: F02 implemented `/login` (real, working) and wired real `RequireAuth`/
`RequirePermission` gating onto `(staff)`/`(portal)`. F03 implemented `/leads`, `/leads/[id]`,
`/students`, `/students/[id]`, `/cases`, `/cases/[id]`. F04 implemented `/contracts`,
`/contracts/[id]`, `/contracts/[id]/payments`, `/cases/[caseId]/assessments`,
`/assessments/[id]`, `/cases/[caseId]/roadmaps`, `/roadmaps/[id]`, `/cases/[caseId]/profile`,
`/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` — real API-backed pages, no new
routes beyond this F01-mapped set (one deviation, documented below: no standalone
`/payments/[id]` route — see the "Payments" row). Every other domain route below (Admission,
Visa, Partners, ...) remains F05+ scope, not yet built; `(staff)/dashboard` and
`(portal)/portal` remain the F01 placeholder pages behind real auth.

## Route groups

| Group | URL prefix | Shell | Roles |
|---|---|---|---|
| `app/(auth)/...` | *(none — route group)* | public, centered card, no `RequireAuth` | anyone (unauthenticated) |
| `app/(staff)/...` | *(none — route group)* | desktop-first, sidebar nav, `RequireAuth` | all 7 non-portal roles |
| `app/(portal)/portal/...` | `/portal` | responsive, no sidebar, `RequireAuth` + `RequirePermission(portal, access)` | `STUDENT_PARENT` only (`portal:access`) |

## AUTH (public) — implemented in F02

| Page | Route | Backend | Status |
|---|---|---|---|
| Login (+ MFA challenge step) | `/login` | `POST /auth/login`, `POST /auth/mfa/login-verify` | Implemented |
| Password reset | *(not built)* | `POST /auth/password-reset/request`, `.../confirm` | Not in F02 scope — see `FRONTEND_AUTH.md` §12 |
| MFA enrollment | *(not built)* | `POST /auth/mfa/enroll`, `.../enroll/confirm` | Not in F02 scope (settings feature, needs an authenticated session) — see `FRONTEND_AUTH.md` §5 |

## INTERNAL STAFF

| Domain | Route | Backend | Phase |
|---|---|---|---|
| Dashboard | `/dashboard` | `GET /reports/executive` \| `/reports/manager` \| `/reports/me` (role-dependent) | F04+ (still the F01 placeholder — dashboard content itself was not in F03's Lead/Student/Case scope) |
| Leads | `/leads` | `GET /leads` | **Implemented (F03)** |
| Leads | `/leads/[id]` | `GET /leads/:id`, `PATCH .../status`, `PATCH .../assign`, `POST .../convert`, `POST .../notes`, `GET .../timeline` | **Implemented (F03)** |
| Students | `/students` | `GET /students` | **Implemented (F03)** |
| Students | `/students/[id]` | `GET /students/:id`, `PATCH .../archive`, `GET/POST .../contacts`, `GET .../timeline`, `POST .../notes`, `GET /cases?studentId=`, `POST .../cases` | **Implemented (F03)** |
| Cases | `/cases` | `GET /cases` | **Implemented (F03)** |
| Cases | `/cases/[id]` | `GET /cases/:id`, `PATCH .../stage`\|`.../status`\|`.../close`, `GET/POST/DELETE .../members`, `POST .../reassign-owner`, `POST .../notes`, `GET .../timeline` | **Implemented (F03)** |
| Contracts | `/contracts` | `GET /contracts` | **Implemented (F04)** |
| Contracts | `/contracts/[id]` | `GET /contracts/:id` (+ `.../amendments`, `.../submit`\|`.../approve`\|`.../reject`\|`.../send`\|`.../sign`\|`.../status`) | **Implemented (F04)** |
| Contract templates | `/contract-templates` | `GET /contract-templates` — consumed as an optional picker inside the Contract create dialog, no standalone list page (matches its non-standalone role on the backend) | **Implemented (F04)** |
| Payments | `/contracts/[id]/payments` | `GET /contracts/:contractId/payments` — **no standalone `/payments` list exists on the backend** (only `GET /payments/export` and `GET /payments/:id`), so payments are only ever browsed from their parent Contract, never a global payments list. Payment *detail* (record/refund/waive) is a dialog opened from this list, not a separate `/payments/[id]` route — F01's route map never mapped one; documented as an ASSUMPTION in `docs/frontend/phase-status/PHASE_F04.md`. | **Implemented (F04)** |
| Assessment | `/cases/[caseId]/assessments`, `/assessments/[id]` | `GET /cases/:caseId/assessments`, `GET /assessments/:id` (+ `.../submit`\|`.../approve`\|`.../reject`\|`.../criteria`) | **Implemented (F04)** |
| Roadmap | `/cases/[caseId]/roadmaps`, `/roadmaps/[id]` | `GET /cases/:caseId/roadmaps`, `GET /roadmaps/:id` (+ `.../submit`\|`.../approve`\|`.../reject`\|`.../status`, `.../milestones`, `/milestones/:id` incl. status/dependencies) — milestone detail/management lives inline on the Roadmap detail page, not a separate `/milestones/[id]` route (no such route in F01's map) | **Implemented (F04)** |
| Profile (academic/test/competition/research/activity) | `/cases/[caseId]/profile` (tabbed) | `GET/POST /cases/:caseId/academic-records` \| `/test-records` \| `/competitions` \| `/research-projects` \| `/activities` (+ per-record `PATCH`, `.../verify` for Academic/Test/Activity) | **Implemented (F04)** |
| Writing | `/cases/[caseId]/writing-artifacts`, `/writing-artifacts/[id]` | `GET /cases/:caseId/writing-artifacts`, `GET /writing-artifacts/:id` (embeds `.versions` — no separate versions-list endpoint despite API_CONVENTIONS.md, see PHASE_F04.md discrepancy note) (+ `.../status`, `.../versions`, `/writing-versions/:id/review`\|`.../comments`) | **Implemented (F04)** |
| Letters of recommendation | `/cases/[caseId]/writing-artifacts` (LOR tracking card — no separate route, F01 never mapped one) | `GET/POST /cases/:caseId/letters-of-recommendation`, `PATCH /letters-of-recommendation/:id` | **Implemented (F04)** |
| Universities | `/universities`, `/universities/[id]` | `GET /universities`, `GET /universities/:id` | F05 |
| Programs | `/programs`, `/programs/[id]` | `GET /programs`, `GET /programs/:id` | F05 |
| Scholarships (master) | `/scholarship-masters`, `/scholarship-masters/[id]` | `GET /scholarship-masters`, `GET /scholarship-masters/:id` | F05 |
| University choices | `/students/[studentId]/university-choices` | `GET /students/:studentId/university-choices` | F05 |
| Applications | `/cases/[caseId]/applications`, `/applications/[id]` | `GET /cases/:caseId/applications`, `GET /applications/:id` (+ `.../checklist`) | F05 |
| Offers | `/applications/[applicationId]/offers`, `/offers/[id]` | `GET /applications/:applicationId/offers`, `GET /offers/:id` | F05 |
| Scholarship applications | `/cases/[caseId]/scholarship-applications`, `/scholarship-applications/[id]` | `GET /cases/:caseId/scholarship-applications`, `GET /scholarship-applications/:id` | F05 |
| Visa | `/cases/[caseId]/visas`, `/visas/[id]` | `GET /cases/:caseId/visas`, `GET /visas/:id` (+ `.../checklist`) | F06 |
| Visa checklist templates | `/visa-checklist-templates` | `GET /visa-checklist-templates` | F06 |
| Pre-departure | `/cases/[caseId]/pre-departure` | `GET /cases/:caseId/pre-departure` | F06 |
| Enrollment | `/cases/[caseId]/enrollments`, `/enrollments/[id]` | `GET /cases/:caseId/enrollments`, `GET /enrollments/:id` | F06 |
| Partners | `/partners`, `/partners/[id]` | `GET /partners`, `GET /partners/:id` (+ `.../programs`, `.../documents`, `.../student-links`) | F06 |
| Commission | `/partners/[partnerId]/commission-rules`, `/commission-transactions`, `/commission-transactions/[id]` | `GET /partners/:partnerId/commission-rules`, `GET /commission-transactions` | F06 |
| Documents | *(no standalone `/documents` list)* — reached only via the owning record (a Case's evidence tab, a Contract's signed artifact, ...), each fetching `GET /documents/:id` for a known ID; there is no bare `GET /documents` list on the backend | F07 |
| Notifications | `/notifications` | `GET /notifications` | F07 |
| Reports | `/reports` (or role-routed to the dashboard variant above), `/reports/cases/export` | `GET /reports/executive` \| `/reports/manager` \| `/reports/me`, `GET /reports/cases/export` | F07 |
| Admin / Identity — Users | `/admin/users`, `/admin/users/[id]` | `GET /users`, `GET /users/:id` | F07 |
| Admin / Identity — Audit logs | `/admin/audit-logs` | `GET /audit-logs` | F07 |
| Admin / Identity — Jobs | `/admin/jobs`, `/admin/jobs/[id]` | `GET /admin/jobs`, `GET /admin/jobs/:id` | F07 |

## PORTAL

Prefix `/portal`, gated by `portal:access` (STUDENT_PARENT only). Every route below requires
`[id]` (a student id) except `/portal` itself, which resolves the caller's accessible
student(s) server-side (`GET /portal/me`) — the frontend never accepts a client-chosen student
id without the backend independently re-validating OWN_STUDENT scope.

| Domain | Route | Backend | Phase |
|---|---|---|---|
| Portal home / student picker | `/portal` | `GET /portal/me` | F08 (stub exists from F01) |
| Student profile | `/portal/students/[id]` | `GET /portal/students/:id` | F08 |
| Roadmap | `/portal/students/[id]/roadmap` | `GET /portal/students/:id/roadmap` | F08 |
| Tasks | `/portal/students/[id]/tasks`, `/portal/students/[id]/tasks/[taskId]` | `GET /portal/students/:id/tasks(/:taskId)` | F08 |
| Documents | `/portal/students/[id]/documents` | `GET /portal/students/:id/documents` (+ `.../download/:documentId`) | F08 |
| Applications | `/portal/students/[id]/applications`, `.../[applicationId]` | `GET /portal/students/:id/applications(/:applicationId)` | F08 |
| Scholarships | `/portal/students/[id]/scholarships`, `.../[scholarshipApplicationId]` | `GET /portal/students/:id/scholarships(/:scholarshipApplicationId)` | F08 |
| Visa | `/portal/students/[id]/visa`, `.../[visaId]` | `GET /portal/students/:id/visa(/:visaId)` | F08 |
| Pre-departure | `/portal/students/[id]/pre-departure` | `GET /portal/students/:id/pre-departure` | F08 |
| Enrollment | `/portal/students/[id]/enrollment` | `GET /portal/students/:id/enrollment` | F08 |
| Contracts / Payments | `/portal/students/[id]/contracts`, `.../[contractId]/payments` | `GET /portal/students/:id/contracts(/:contractId/payments)` | F08 |
| Notifications | `/portal/students/[id]/notifications` | `GET /portal/students/:id/notifications` | F08 |

### Student Portal / Parent Portal — one route tree, not two

`frontend_prompts` §6 lists "Student Portal" and "Parent Portal" as separate line items, but
the backend makes no such distinction: one role (`STUDENT_PARENT`), one gate (`portal:access`),
one `GET /portal/me` that resolves every student the *caller* may see — themselves if they are
the student, or any child they hold an ACTIVE parent link to
(`docs/security/RBAC_MATRIX.md` §3). The route table above is intentionally a single tree for
both cases: `/portal` shows a student picker when more than one student is accessible (the
parent case) or goes straight to the one accessible student (the self-student case) — never a
parallel `/portal/parent/...` tree. This is a frontend-documentation clarification, not a
requirement conflict — recorded here per §7's "nếu requirement chưa rõ: ghi assumption."

## Not modeled as routes (deliberately)

- **`GET /public/contracts/review/:token`**, **`POST /public/portal/parent-invitations/:token/accept`**,
  **`GET /documents/download/:token`** — all `@Public()`, token-authenticated, single-purpose
  links (contract review, parent-invite acceptance, document download redemption). These need
  a route (e.g. `/public/contracts/review/[token]`, `/public/portal/invite/[token]`) but are
  **not part of the staff/portal route trees above** — no login, no shell, no nav — and belong
  to whichever phase first implements Contracts (F04) / Portal invites (F08) / Documents (F07).
- Auth routes: `/login` is now implemented (see "AUTH (public)" above) — `/mfa` is not a
  separate route (the MFA challenge is a step within the `/login` page, not its own URL);
  `/password-reset` remains unbuilt (F02 instruction scope did not require it).
