# FRONTEND PERMISSION MAP — Phase F01 (designed), implemented F02, consumed F03, F04

**Status**: this document's data is now real code — `lib/permissions/rbac-data.ts`
(`ROLE_GRANTS`, `STUDENT_CASE_SCOPE`/`LEAD_SCOPE`/`CONTRACT_PAYMENT_SCOPE`) and
`lib/permissions/use-permissions.ts` (`can`/`canAny`/`canAll`/`usePermissions()`), consumed
by `Sidebar` (nav filtering) and `RequirePermission` (section gating). Every per-role grant
below has a corresponding line in `rbac-data.ts` — keep both in sync if `RBAC_MATRIX.md` ever
changes.

**F03**: every Lead/Student/Case action button (create/edit/assign/convert/close/member-
management) is gated by `usePermissions().can(resource, action)` against the exact grants
below — never a role-name check. One F03-specific gap worth documenting: `GET /users`
(`users:view`) is EXECUTIVE_DIRECTOR/SYSTEM_ADMIN-only, but `leads:assign`/`cases:assign` are
also granted to DEPARTMENT_MANAGER/CONSULTANT, who therefore have no backend-accessible way
to browse a user list when picking an owner/collaborator. `components/crm/user-picker.tsx`
degrades to a manual user-ID text input for any role without `users:view` — a real, documented
limitation (not a bug to silently work around by calling a different endpoint), recorded in
`docs/frontend/phase-status/PHASE_F03.md`.

**F04**: every Contract/Payment/Assessment/Roadmap/Profile-Evidence/Writing action is gated
the same way — `usePermissions().can(resource, action)`, never a role-name or FSM-state guess.
`rbac-data.ts`'s existing `contracts`/`payments`/`assessments`/`roadmaps`/`profile_evidence`/
`writing` grants (transcribed in F02/F03) already matched the backend exactly for every F04
role — verified directly against the live `@RequirePermission` decorators during this phase;
**no `rbac-data.ts` change was needed**. Two new F04-specific gaps, both the same
`UserPicker`/`users:view` pattern as F03, documented rather than worked around:

- **`components/crm/student-picker.tsx`** (Contract creation's student field) degrades to a
  manual Student-ID text input for any role without `students:view` — concretely,
  ADMIN_FINANCE (the role that actually creates Contracts day-to-day) holds **zero** `students`
  grant at all (Contract/Payment scope is deliberately separate from Student/Case scope).
  ED/DM get the real search picker (they hold both grants).
- **`components/crm/user-picker.tsx`** gained a `required` prop (default `true`, preserving
  every F03 call site's behavior unchanged) after an F04 bug: two new F04 dialogs
  (`MilestoneFormDialog`, `WritingArtifactFormDialog`) use it for a genuinely *optional* owner
  field, but the picker's manual-fallback `<Input>` hard-coded `required` — silently blocking
  the whole form's native submission for any role without `users:view` even when the field
  itself was optional. Fixed at the component level (`required={false}` passed from those two
  call sites) rather than patched around in each dialog.

**This document is UX guidance only.** It exists so a future phase can decide what nav items/
buttons to show or hide per role. **It is not, and must never become, the security
boundary** — every one of these grants is re-checked server-side on every request regardless
of what the frontend renders (`docs/architecture/TARGET_ARCHITECTURE.md` §1;
`frontend_prompts` MASTER_CONTEXT: "Frontend không được tự quyết định authorization"). Hiding
a button is a convenience; the real deny is the backend's 401/403/404.

Source of truth: `docs/security/RBAC_MATRIX.md` (itself generated from `database/seeds/
seed.ts`'s `GRANTS` constant + `scope-policy.service.ts`'s `ROLE_SCOPE` constants). If this
document and `RBAC_MATRIX.md` ever disagree, **`RBAC_MATRIX.md` and the code are correct** —
fix this document to match, not the other way around.

## Role code discrepancy — resolved

`frontend_prompts/00-context/00_FRONTEND_MASTER_CONTEXT.md` line 45 lists a role
`APPLICATION_DOCUMENT_SPECIALIST`. **This name does not exist anywhere in the backend.** The
real `RoleCode` enum value (`database/schema.prisma`, confirmed consistent throughout
`docs/security/RBAC_MATRIX.md` and `database/seeds/seed.ts`) is:

```
DOCUMENT_SPECIALIST
```

Per instruction, this has been corrected in every frontend document (this one,
`FRONTEND_ROUTES.md`, `FRONTEND_API_MAP.md`, and `lib/auth/session.ts`'s `RoleCode` type) —
`DOCUMENT_SPECIALIST` is used everywhere. **The backend `RoleCode` enum was not touched, and
no alias/second role code was created anywhere.** The master-context document itself still
has the stale name; it is a documentation source, not code, so no code change was needed to
fix the discrepancy, but a future edit to that file should also correct it if convenient.

## How to read this

For each of the 8 roles: its granted `resource:action` pairs (blank = no grant → any route
requiring that permission is `403 PERMISSION_DENIED` for this role, so hide that nav
item/action entirely), and its `ScopeKind` per scoped resource group (which records within a
granted resource it can actually reach — `docs/security/RBAC_MATRIX.md` §3 has the full
per-resource nuance; this table shows the three tracked scope dimensions: Student/Case, Lead,
Contract/Payment).

## EXECUTIVE_DIRECTOR

**Scope**: Student/Case GLOBAL · Lead GLOBAL · Contract/Payment GLOBAL — sees everything.

Full `view/create/edit` (+ `approve` where it exists) across every domain: leads, students,
cases, contracts (+ `approve`/`send`/`sign`/`amend`/`export`), payments (`view`/`export`
only — execution stays ADMIN_FINANCE), tasks, assessments/roadmaps (+ `approve`),
profile_evidence, writing, documents (full incl. `share`/`archive`), admission_master (+
`verify`), university_choices, applications, offers, scholarship_applications, visa (+
templates), pre_departure, enrollment, partner + all 5 partner sub-resources, commission_rules/
transactions, reports (+ `export`). Plus `users:view` (not `suspend`/`offboard` — SYSTEM_ADMIN
only) and zero on `portal`/`jobs`/`audit_logs`.

**Nav**: everything except Admin (Users read-only if shown at all — no suspend/offboard
action), Jobs, Audit Logs, Portal.

## DEPARTMENT_MANAGER

**Scope**: Student/Case GLOBAL (no Department entity exists — `docs/ASSUMPTIONS.md` ASM-06) ·
Lead GLOBAL · Contract/Payment GLOBAL.

Identical grant set to EXECUTIVE_DIRECTOR **except** zero on `users`/`audit_logs` entirely
(not even `users:view`). Same nav as ED minus any Admin/Users entry.

## CONSULTANT

**Scope**: Student/Case **CASE_MEMBER** (must be a member — owner or collaborator — of the
Case; `OWNER` specifically required for case-management writes: stage/status/close/members)
· Lead NONE · Contract/Payment **NONE** (deliberately does not follow Case access).

Grants: students(`view,edit`), cases(`view,edit,assign,close`), tasks(`view,create,edit,
assign`), assessments/roadmaps/profile_evidence/writing(`view,create,edit` — never
`approve`), documents(full incl. `share`/`archive`), admission_master(`view` only —
full `view,create,edit` on university_choices/applications/offers/scholarship_applications
instead), visa/pre_departure/enrollment(`view,create,edit`), visa_checklist_templates(`view`
only), reports(`view`). **Zero**: leads, contracts, payments, partner (all 6), portal,
jobs, users, audit_logs.

**Nav**: Students/Cases (their own cases only — list is pre-filtered server-side), Tasks,
Counseling (Assessment/Roadmap/Profile/Writing), Admission execution, Visa execution, no
Leads/Contracts/Payments/Partners/Admin/Portal at all.

## DOCUMENT_SPECIALIST

**Scope**: Student/Case **CASE_MEMBER** (same rule as CONSULTANT) · Lead NONE · Contract/
Payment NONE.

Narrower than CONSULTANT on case management (no `cases:edit/assign/close`) but same
`tasks:*` grant. View-only on the four counseling resources (its domain is Document/
Application/Visa paperwork, not counseling). Grants: students(`view`), cases(`view`),
tasks(`view,create,edit,assign`), assessments/roadmaps/profile_evidence/writing(`view`
only), documents(full — this genuinely is its domain), admission_master(`view`),
applications(`view,create,edit` — its actual processing domain), university_choices/offers/
scholarship_applications(`view`), visa/pre_departure(`view,create,edit`),
visa_checklist_templates/enrollment(`view`), partner(`view`), partner_documents(`view`),
reports(`view`). **Zero**: leads, contracts, payments, partner_programs, partner_student_
links, commission (both), portal, jobs, users, audit_logs.

**Nav**: similar shape to CONSULTANT but every "edit" narrower to "view" outside Documents/
Applications/Visa/Tasks — most useful as a document-processing-focused nav variant, not a
role-forked page set (§ "feature-folder organization," `FRONTEND_ARCHITECTURE.md` §5).

## SALES_MARKETING

**Scope**: Student/Case NONE (blocked at the coarse permission layer, never reaches a scope
check) · Lead **OWN_LEAD** (only leads it owns) · Contract/Payment NONE.

Grants: leads(`view,create,edit,assign,convert`), admission_master(`view` — public catalog
only), visa_checklist_templates(`view`), reports(`view`). **Zero on everything else**,
including students/cases/contracts/payments/documents/partner (all 6)/portal/jobs/users/
audit_logs.

**Nav**: Leads only, plus read-only catalog browsing (Universities/Programs — informational
context for a prospect conversation, not student-linked data). No Students/Cases/Contracts/
Documents/Partners/Admin/Portal.

## ADMIN_FINANCE

**Scope**: Student/Case NONE · Lead NONE · Contract/Payment **GLOBAL** (its entire domain,
unlike its NONE everywhere else).

Grants: contracts(`view,create,edit,send,sign,export` — **not** `approve`/`amend`, those stay
ED/DM), payments(`view,create,record,refund,waive,export` — full execution), partner/
partner_programs/partner_documents/partner_student_links(`view` only — context, not
relationship management), commission_rules/commission_transactions(`view,create,edit` — full
settlement execution), reports(`view`). **Zero**: leads, students, cases, tasks, all
counseling resources, admission_master, visa (all), enrollment, documents, portal, jobs,
users, audit_logs.

**Nav**: Contracts, Payments, Commission/Partner (read + commission execution) only. No
Students/Cases/Leads/Counseling/Admission/Visa/Documents/Admin/Portal.

## STUDENT_PARENT

**Scope**: Student/Case **OWN_STUDENT** (self, or an ACTIVE-linked parent — revocation-aware,
checked live every request, never cached) · Lead NONE · Contract/Payment **OWN_STUDENT**
(same rule, resolved through `Contract.studentId`).

View-only across almost everything relevant to its own record: students/cases/contracts/
payments/assessments/roadmaps/profile_evidence/writing/admission_master/university_choices/
applications/offers/scholarship_applications/visa/visa_checklist_templates/pre_departure
(`view`), documents(`view,download`), plus the one write-capable grant: `documents:create`
(Phase 11 self-service upload). **Plus `portal:access`** — the only role that has it; every
other role gets zero. **Zero**: leads, tasks, enrollment (view comes through the Portal's own
narrow read path, not this generic grant table — see `RBAC_MATRIX.md` §2's Phase 11 note),
partner (all 6), reports, jobs, users, audit_logs.

**Nav**: this role never sees the staff `(staff)` shell at all — it only ever reaches
`(portal)/portal/...` (the `portal:access` gate is class-level on `PortalController`; a
STUDENT_PARENT hitting any staff route gets `403` from the coarse permission check before any
scope logic runs, since none of the staff-resource grants above are present).

## SYSTEM_ADMIN

**Scope**: Student/Case NONE · Lead NONE · Contract/Payment NONE — **zero business-domain
access by design** (SRS: "Không mặc định được đọc nội dung hồ sơ nhạy cảm nếu không được cấp
business permission").

Grants: `users:view,suspend,offboard`, `audit_logs:view`, `jobs:view`. That's the entire
grant set — confirmed empirically this project cycle (live production RBAC smoke test:
SYSTEM_ADMIN correctly received `403 PERMISSION_DENIED` on `/students`, `/documents/:id`, and
`/portal/me`).

**Nav**: Admin (Users, Audit Logs, Jobs) only. Every business-domain nav item is hidden for
this role — not because of a UI convention, but because the role provably cannot reach any of
it; showing those nav items would just be a guaranteed-403 dead click.

## Special-cased exceptions (not in the grant table)

- **`sessions:revoke-any`** — a `roleCode === 'SYSTEM_ADMIN'` check hard-coded in
  `AuthController.revokeSession`, not a permission grant. A "revoke this user's session" admin
  action should only be shown for SYSTEM_ADMIN, and even then the frontend must still handle
  a possible 403 (the special-case could change).
- **`POST /payments/reminders/run`, `POST /tasks/reminders/run`** — SYSTEM_ADMIN/
  EXECUTIVE_DIRECTOR only, same special-cased-roleCode pattern, not in the table above.
