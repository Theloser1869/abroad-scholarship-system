# UAT Findings — Phase 13

Scope: `13-qa/03_UAT_REVIEW.md`. Simulated all 8 roles (Executive Director, Department Manager, Consultant, Application/Document Specialist, Sales/Marketing, Administration/Finance, Student, Parent) walking the full Lead→...→Closure lifecycle each role realistically touches, using the actual API surface (never inferred from a UI, since none exists in this repository) and the existing e2e test suite as primary evidence, supplemented by direct code reads where tests didn't cover a specific check.

For each role: can the user complete their task, is data available at the correct stage, is permission safe, are deadlines clear, is ownership clear, is history sufficient.

**Result: 0 CRITICAL, 0 HIGH. 2 MEDIUM (both fixed), 1 LOW (documented, test-gap only). All 8 roles can complete their SRS-defined workflows end-to-end through the existing API.**

---

### Executive Director

- **Workflow walked**: login → `/reports/executive` (pipeline/revenue/receivables/applications/scholarships/visas/enrollments/closure) → `/reports/manager` (per-owner workload/overdue/quality) → `/reports/cases/export` → Contract approval (threshold-gated) → unrestricted Case oversight (GLOBAL scope).
- **Can complete task**: YES.
- **Data at correct stage**: OK.
- **Permission safety**: OK — GLOBAL scope everywhere; contract approval above a monetary threshold further gated to authorized approvers.
- **Deadline clarity**: **Fixed** — see finding #1.
- **Ownership clarity**: OK.
- **History sufficiency**: OK — full `audit_logs:view`.
- **Findings**:
  - **#1 MEDIUM (fixed)** — `/reports/executive` omitted `workload` and `deadlines`, both explicitly named in SRS §6.21's "Dashboard GĐĐH" list; they were reachable only via a second call to `/reports/manager`. **Fix**: added org-wide `workload`/`deadlines` summaries directly to `executiveDashboard()`, reusing `TasksService.isOverdue` as the sole source of truth. Regression test: `reporting.e2e-spec.ts` "includes workload and deadlines summaries."

### Department Manager

- **Workflow walked**: same dashboards as ED → assign a case owner/collaborator → set task deadlines → view per-owner workload/overdue/quality.
- **Can complete task**: YES (after fix #2).
- **Data at correct stage**: OK.
- **Permission safety**: OK — `cases:assign`, `assertManageable` requires GLOBAL or OWNER `CaseMember`.
- **Deadline clarity**: OK.
- **Ownership clarity**: **Fixed** — see finding #2.
- **History sufficiency**: OK.
- **Findings**:
  - **#2 MEDIUM (fixed)** — no dedicated case-owner-*reassignment* action existed; `POST /cases/:id/members` with `role: OWNER` upserted a *second* co-existing OWNER without demoting the first, and `Case.ownerId` (set once at creation) never updated — leaving "who owns this case now" without a single authoritative answer after a manager tried to reassign it. **Fix**: added `POST /cases/:id/reassign-owner`, which demotes every prior OWNER `CaseMember` to COLLABORATOR and updates `Case.ownerId` atomically. Regression test: `case-management.e2e-spec.ts` "reassigns the case owner."

### Consultant

- **Workflow walked**: Assessment → Roadmap+Milestones → Profile evidence (Academic/Test/Competition/Research/Activity) → Writing/LOR, on an owned/collaborated case.
- **Can complete task**: YES.
- **Data at correct stage**: OK — `assessments:approve`/`roadmaps:approve` correctly withheld (ED/DM only), matching the SRS's approval separation-of-duties.
- **Permission safety**: OK — `CONTRACT_ROLE_SCOPE` is NONE for Consultant; zero `commission_*` grant; **visa evidence document access was over-granted — see Security Test Report finding #3, now fixed** (Consultant is view-only on visa evidence they didn't upload).
- **Deadline clarity**: OK.
- **Ownership clarity**: OK.
- **History sufficiency**: OK within case scope.
- **Findings**: none CRITICAL/HIGH remaining after the visa-evidence fix (tracked in the Security Test Report, not duplicated here).

### Application / Document Specialist

- **Workflow walked**: Document upload/version/share → Application checklist → Offer → Scholarship → Visa/pre-departure paperwork.
- **Can complete task**: YES.
- **Data at correct stage**: OK.
- **Permission safety**: OK — `assessments/roadmaps/profile_evidence/writing` are view-only; zero `contracts`/`payments`/`commission_*` grant, matching "Hồ sơ: không mặc định xem giá trị hợp đồng/payment."
- **Deadline clarity**: OK.
- **Ownership clarity**: OK.
- **History sufficiency**: OK.
- **Findings**: none.

### Sales / Marketing

- **Workflow walked**: Lead create → qualify → assign → convert.
- **Can complete task**: YES.
- **Data at correct stage**: OK.
- **Permission safety**: OK — zero grant on `students/cases/contracts/payments/visa/documents/partner*`; `admission_master:view` exposes only the public catalog, not student-linked records; `/reports/executive`/`/manager` blocked by role-check even though `reports:view` is granted (only the aggregate `/reports/me` is reachable) — confirms AC-03 holds on every reachable endpoint, not just the obvious ones.
- **Deadline clarity**: OK (N/A — Lead has no deadline concept in the SRS).
- **Ownership clarity**: OK — `OWN_LEAD` scope, ALLOW/DENY both tested.
- **History sufficiency**: OK within Lead scope.
- **Findings**: none.

### Administration / Finance

- **Workflow walked**: Contract from-template → submit → approve/reject → send → sign → amend → Payment schedule → record/refund/waive → overdue detection → Commission → Case closure precondition (no outstanding debt).
- **Can complete task**: YES — full lifecycle endpoints exist.
- **Data at correct stage**: OK.
- **Permission safety**: OK — zero grant on `visa/pre_departure/enrollment/assessments/roadmaps/profile_evidence/writing`, confirming finance never automatically gains counseling/visa access.
- **Deadline clarity**: OK (Payment `dueDate`, overdue flag).
- **Ownership clarity**: OK (N/A — Contract has no per-Contract "owner" concept beyond Student/Case in the SRS).
- **History sufficiency**: OK.
- **Findings**: none.

### Student

- **Workflow walked**: login → `/portal/me` → profile/roadmap/tasks/documents/applications/scholarships/visa/pre-departure/enrollment/contracts(view)/payments(view)/notifications.
- **Can complete task**: YES for every listed self-service action; Contract/Payment routes are `@Get`-only — confirmed view-only, no student-side mutation path exists.
- **Data at correct stage**: OK.
- **Permission safety**: OK, with direct evidence — cross-student IDOR DENY (`GET /portal/students/:otherStudentId` → 404 for a different self-student token); Task internal fields redacted unconditionally on the Portal path; no commission/audit/staff-KPI exposure anywhere (Portal has no such routes at all).
- **Deadline clarity**: OK (Task deadline, Application deadline, Payment due date all visible read-only).
- **Ownership clarity**: OK (Task owner, Case context visible).
- **History sufficiency**: OK (notifications, task status history via task detail).
- **Findings**: none.

### Parent

- **Workflow walked**: invitation → accept → multi-child linking → revoke → re-invite.
- **Can complete task**: YES.
- **Data at correct stage**: OK.
- **Permission safety**: OK, with direct evidence — linked Child A → ALLOW (200); unlinked Child B → DENY (404) even with a known studentId; a *revoked* link → DENY (404), proving the check is `portalStatus`-based, not a null-check; revocation takes effect on the very next request using the **same already-issued token**, no re-login required (`portal.e2e-spec.ts` issues one token, confirms 200 before revoke, revokes, reuses the same token, confirms 404).
- **Deadline clarity**: OK (same fields as Student view).
- **Ownership clarity**: OK (relationship type shown per `/portal/me`).
- **History sufficiency**: OK.
- **Findings**:
  - **#3 LOW (documented, not fixed)** — document-access revocation-on-parent-revoke is documented and the code path exists (`PortalAccessService.revokeParentAccess` expires `DocumentAccess` rows in the same transaction as the contact revoke), but no dedicated e2e assertion directly proves a previously-issued `DocumentAccess` grant is unusable immediately post-revoke (only the profile/sub-resource routes are directly tested at that point). Tracked as a test-coverage gap for a future phase, not treated as a defect since the code path was independently confirmed correct by reading `PortalAccessService`.

---

## Consolidated findings — all roles, sorted by severity

| # | Severity | Role(s) | Finding | Status |
|---|---|---|---|---|
| 1 | MEDIUM | Executive Director | `/reports/executive` missing `workload`/`deadlines` (SRS §6.21) | **Fixed** |
| 2 | MEDIUM | Department Manager | No case-owner reassignment endpoint; `Case.ownerId` went stale | **Fixed** |
| 3 | LOW | Parent | No e2e proof that a `DocumentAccess` grant is unusable immediately post-revoke (code confirmed correct by read) | Documented (test-gap) |

No CRITICAL or HIGH findings surfaced in this UAT pass. All 8 roles can complete their SRS-defined realistic workflows end-to-end through the existing API surface, with the highest-risk permission boundaries (Sales/Marketing's zero visibility into sensitive data, Finance not auto-gaining counseling/visa access, Student/Parent cross-account IDOR, and parent-revocation immediacy) independently confirmed by name-cited e2e tests, not design-doc claims alone.
