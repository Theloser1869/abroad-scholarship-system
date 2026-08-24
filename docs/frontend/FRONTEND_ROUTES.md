# FRONTEND ROUTES — Phase F01 (routing plan), updated F02 (auth routes), F03 (CRM routes), F04 (Commercial + Profile/Counseling routes), F05 (Admission routes), F06 (Visa + Pre-departure + Enrollment + Partner routes), F07 (Documents + Notifications + Reporting routes), F08 (Student/Parent Portal routes), F09 (route-folder param-name fix, no URL/behavior change — see note below)

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
`/payments/[id]` route — see the "Payments" row). F05 implemented `/universities`,
`/universities/[id]`, `/programs`, `/programs/[id]`, `/scholarship-masters`,
`/scholarship-masters/[id]`, `/students/[studentId]/university-choices`,
`/cases/[caseId]/applications`, `/applications/[id]`, `/applications/[applicationId]/offers`,
`/offers/[id]`, `/cases/[caseId]/scholarship-applications`, `/scholarship-applications/[id]` —
exactly F01's mapped Admission set, no invented routes. F06 implemented `/cases/[caseId]/visas`,
`/visas/[id]`, `/visa-checklist-templates`, `/cases/[caseId]/pre-departure`,
`/cases/[caseId]/enrollments`, `/enrollments/[id]`, `/partners`, `/partners/[id]`,
`/partners/[partnerId]/commission-rules`, `/commission-transactions`,
`/commission-transactions/[id]` — exactly F01's mapped Visa/Partner set (see ASM-67/68 for the
two route-scoping decisions this phase made reading F01's own cell-grouping vs. bracketed-route
syntax: PartnerProgram/PartnerDocument/PartnerStudentLink are sections-with-Dialogs on
`/partners/[id]`, never standalone routes; CommissionRule is list-only, CommissionTransaction is
global-only). F07 implemented `/documents`, `/documents/upload`, `/documents/[id]`,
`/notifications`, `/dashboard` (fleshed out from the F01 placeholder), `/reports` — see
ASM-71 through ASM-78 for this phase's route-scoping decisions (no `/documents` list route
exists on the backend at all; `/dashboard` vs `/reports` split into KPI-views vs. export). F08
implemented every PORTAL route below (`/portal` + all eleven `/portal/students/[id]/...`
sub-routes), plus one route F01 never explicitly mapped: `/public/portal/invite/[token]` (the
parent-invitation acceptance page — named in F01's own "public token-authorized links" note as
belonging to "whichever phase first implements... Portal invites (F08)"). See ASM-79 through
ASM-86 for this phase's findings.

### F09 note — three route folders renamed internally (`caseId`/`applicationId`/`partnerId` → `id`), no URL or behavior change

`next dev`'s proxy/middleware compilation (never exercised locally before F09, since no prior
phase had actually run `next dev` — only `next build`, which does not perform this check) threw
`Error: You cannot use different slug names for the same dynamic path` for three route trees
that had grown a sibling directory with a differently-named dynamic segment at the same tree
position: `app/(staff)/applications/[applicationId]/offers` (sibling of `.../applications/[id]`),
`app/(staff)/cases/[caseId]/**` (nine sub-routes, sibling of `.../cases/[id]`), and
`app/(staff)/partners/[partnerId]/commission-rules` (sibling of `.../partners/[id]`). Fixed by
renaming each folder to `[id]` to match its sibling and updating the moved page's own
`params: Promise<{ id: string }>` destructuring accordingly — the route table below's bracket
notation (`[caseId]`, `[applicationId]`, `[partnerId]`) reflects the pre-F09 internal param name
for readability of *which* id a route needs, but the actual folder/param name for all three is
now `id`. **No URL, no route behavior, no backend contract changed** — a request to
`/cases/abc123/applications` resolves exactly as before; only the internal Next.js param name
changed. Full detail in `docs/frontend/phase-status/PHASE_F09.md`.

## Route groups

| Group | URL prefix | Shell | Roles |
|---|---|---|---|
| `app/(auth)/...` | *(none — route group)* | public, centered card, no `RequireAuth` | anyone (unauthenticated) |
| `app/(staff)/...` | *(none — route group)* | desktop-first, sidebar nav, `RequireAuth` | all 7 non-portal roles |
| `app/(portal)/portal/...` | `/portal` | responsive, mobile-first, no sidebar (`PortalNav` horizontal tab strip instead), `RequireAuth` + `RequirePermission(portal, access)` | `STUDENT_PARENT` only (`portal:access`) |
| `app/(public)/...` | *(none — route group)* | public, centered card, no `RequireAuth` (F08 — mirrors `(auth)` exactly) | anyone, token-authorized per-page |

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
| Universities | `/universities`, `/universities/[id]` | `GET /universities`, `GET /universities/:id` (+ `.../verify`) | **Implemented (F05)** |
| Programs | `/programs`, `/programs/[id]` | `GET /programs`, `GET /programs/:id` (+ `.../verify`) — embeds a University summary (DEC-11) | **Implemented (F05)** |
| Scholarships (master) | `/scholarship-masters`, `/scholarship-masters/[id]` | `GET /scholarship-masters`, `GET /scholarship-masters/:id` (+ `.../verify`) | **Implemented (F05)** |
| University choices | `/students/[studentId]/university-choices` | `GET /students/:studentId/university-choices` (+ `POST .../review` on `/university-choices/:id`) — embeds a Program(+University) summary (DEC-11); student-scoped, not case-scoped despite the optional `caseId` linkage field; no standalone `/university-choices/[id]` detail route exists (matches F01's map — edit/review are Dialogs from the list, same "no invented route" precedent as F04's Payment) | **Implemented (F05)** |
| Applications | `/cases/[caseId]/applications`, `/applications/[id]` | `GET /cases/:caseId/applications`, `GET /applications/:id` (+ `.../submit`\|`.../status`, embeds `checklist`/`offers`/`scholarshipApplications` + a Program(+University) summary, DEC-11) | **Implemented (F05)** |
| Application checklist | *(embedded on the Application detail response — no separate route)* | `GET/POST /applications/:applicationId/checklist`, `PATCH /checklist-items/:id` | **Implemented (F05)** |
| Offers | `/applications/[applicationId]/offers`, `/offers/[id]` | `GET /applications/:applicationId/offers`, `GET /offers/:id` (+ `.../current`, `POST .../respond`) | **Implemented (F05)** |
| Scholarship applications | `/cases/[caseId]/scholarship-applications`, `/scholarship-applications/[id]` | `GET /cases/:caseId/scholarship-applications`, `GET /scholarship-applications/:id` (+ `.../confirm-eligibility`\|`.../status`\|`.../award`\|`.../reject`, embeds a ScholarshipMaster summary, DEC-11) | **Implemented (F05)** |
| Visa | `/cases/[caseId]/visas`, `/visas/[id]` | `GET /cases/:caseId/visas`, `GET /visas/:id` (+ `.../checklist`) | F06 |
| Visa checklist templates | `/visa-checklist-templates` | `GET /visa-checklist-templates` | F06 |
| Pre-departure | `/cases/[caseId]/pre-departure` | `GET /cases/:caseId/pre-departure` | F06 |
| Enrollment | `/cases/[caseId]/enrollments`, `/enrollments/[id]` | `GET /cases/:caseId/enrollments`, `GET /enrollments/:id` | F06 |
| Partners | `/partners`, `/partners/[id]` | `GET /partners`, `GET /partners/:id` (+ `.../programs`, `.../documents`, `.../student-links`) | F06 |
| Commission | `/partners/[partnerId]/commission-rules`, `/commission-transactions`, `/commission-transactions/[id]` | `GET /partners/:partnerId/commission-rules`, `GET /commission-transactions` | F06 |
| Documents | `/documents` (lookup+upload hub, NOT a list), `/documents/upload`, `/documents/[id]` | `POST /documents`, `GET /documents/:id`, `PATCH /documents/:id`, `POST /:id/share`\|`.../archive`\|`.../versions`, `GET /:id/download` | **Implemented (F07)** — no standalone `/documents` list exists (reached only via the owning record's evidence link or a known id; there is no bare `GET /documents` list on the backend — ASM-71) |
| Notifications | `/notifications` | `GET /notifications`, `PATCH /notifications/:id/read` | **Implemented (F07)** |
| Reports | `/dashboard` (role-routed Executive/Manager/Me KPI views), `/reports` (export UI) | `GET /reports/executive` \| `/reports/manager` \| `/reports/me`, `GET /reports/cases/export` | **Implemented (F07)** — ASM-78 explains the `/dashboard` vs `/reports` split |
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
| Portal home / student picker | `/portal` | `GET /portal/me` | **Implemented (F08)** |
| Student profile | `/portal/students/[id]` (also the Overview — F08 instruction §12) | `GET /portal/students/:id` (+ every domain area's own list endpoint for the Overview summary, ASM-82) | **Implemented (F08)** |
| Roadmap | `/portal/students/[id]/roadmap` | `GET /portal/students/:id/roadmap`, `POST .../roadmap/milestones/:milestoneId/evidence` | **Implemented (F08)** |
| Tasks | `/portal/students/[id]/tasks`, `/portal/students/[id]/tasks/[taskId]` | `GET /portal/students/:id/tasks(/:taskId)`, `PATCH .../output`, `POST .../status` | **Implemented (F08)** |
| Documents | `/portal/students/[id]/documents` | `GET /portal/students/:id/documents` (+ `.../download/:documentId`) | **Implemented (F08)** |
| Applications | `/portal/students/[id]/applications`, `.../[applicationId]` | `GET /portal/students/:id/applications(/:applicationId)`, `POST .../applications/checklist/:checklistItemId/evidence` | **Implemented (F08)** |
| Scholarships | `/portal/students/[id]/scholarships`, `.../[scholarshipApplicationId]` | `GET /portal/students/:id/scholarships(/:scholarshipApplicationId)` | **Implemented (F08)** |
| Visa | `/portal/students/[id]/visa`, `.../[visaId]` | `GET /portal/students/:id/visa(/:visaId)` — no checklist embed (ASM-79) | **Implemented (F08)** |
| Pre-departure | `/portal/students/[id]/pre-departure` | `GET /portal/students/:id/pre-departure` | **Implemented (F08)** |
| Enrollment | `/portal/students/[id]/enrollment` | `GET /portal/students/:id/enrollment` — list only, no detail route (ASM-80) | **Implemented (F08)** |
| Contracts / Payments | `/portal/students/[id]/contracts`, `.../[contractId]/payments` | `GET /portal/students/:id/contracts(/:contractId/payments)` — list only, no Contract detail route (ASM-80) | **Implemented (F08)** |
| Notifications | `/portal/students/[id]/notifications` | `GET /portal/students/:id/notifications` | **Implemented (F08)** |

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

- **`GET /public/contracts/review/:token`**, **`GET /documents/download/:token`** — both
  `@Public()`, token-authenticated, single-purpose links (contract review, document download
  redemption) with no route in this app yet — still deferred to whichever phase actually needs
  them (Contracts review has no frontend consumer through F08; the document-download token is
  redeemed by a plain `window.open`, never a page of its own).
  **`POST /public/portal/parent-invitations/:token/accept`** is no longer in this list — F08
  implemented it as `/public/portal/invite/[token]` (ASM-85), a new `(public)` route group
  (mirroring `(auth)/layout.tsx`'s centered-card, no-`RequireAuth` style) — no login, no shell,
  no nav, same as before, just now a real page.
- Auth routes: `/login` is now implemented (see "AUTH (public)" above) — `/mfa` is not a
  separate route (the MFA challenge is a step within the `/login` page, not its own URL);
  `/password-reset` remains unbuilt (F02 instruction scope did not require it).
