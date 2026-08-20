# ASSUMPTIONS

Mỗi assumption phải ghi: ID, date, context, decision, reason, affected modules.

---

## ASM-01 — "Profile Development" ánh xạ vào domain code `counseling`

**Date**: 2026-08-18
**Context**: `01-discovery/02_TARGET_ARCHITECTURE.md` liệt kê "Counseling" và "Profile Development" như
hai domain boundary riêng biệt, nhưng SRS (mục 4, M05–M11) không có ranh giới rõ ràng để tách hai nhóm
entity này; PHASE_MAP.md gọi Phase 07 là "profile" với scope "Assessment + Roadmap + Evidence + Writing".
**Decision**: Gộp thành một domain vật lý `apps/api/modules/counseling/`. "Profile Development" là tên
nghiệp vụ/label cho một phần chức năng của domain này (Academic/Test/Competition/Research/Activity —
"evidence"), không phải một module code độc lập.
**Reason**: Tránh tự suy diễn ranh giới không có trong SRS; tránh tạo domain trùng ý nghĩa. Xem
`docs/architecture/DECISIONS.md` ARCH-DEC-02.
**Affected modules**: 07-profile (Phase 07 implement vào domain `counseling`, không tạo module
`profile` riêng).

---

## ASM-02 — E-signature: luồng thủ công cho đến khi có quyết định provider

**Date**: 2026-08-18
**Context**: SRS mục 14 (dòng 769) tự xác nhận quy trình e-signature (provider/webhook/signing evidence)
chưa được xác định trong nguồn yêu cầu.
**Decision**: Domain `commercial` định nghĩa interface `SigningProvider` nhưng không chọn provider cụ thể
ở Phase 01. Cho đến khi có quyết định khác, Contract chuyển trạng thái Signed bằng luồng thủ công (staff
upload file đã ký ngoài hệ thống, lưu như Document immutable + audit), không tự tích hợp một provider
thương mại cụ thể.
**Reason**: MASTER_CONTEXT cấm "silently invent business rules"; chọn provider cụ thể không có căn cứ
trong SRS là vượt phạm vi. Xem `docs/architecture/DECISIONS.md` ARCH-DEC-05.
**Affected modules**: 05-commercial (Contract signing flow), 12-platform (nếu sau này tích hợp
e-signature provider thật).

---

## ASM-03 — Pre-departure/Enrollment chưa có entity Data Model riêng trong SRS mục 7

**Date**: 2026-08-18
**Context**: SRS mục 6.15 mô tả chi tiết chức năng Pre-departure & Enrollment (checklist, enrollment
info, điều kiện Closure) nhưng SRS mục 7 (Data Model đề xuất) chỉ liệt kê entity `Visa`, không có entity
riêng cho Pre-departure/Enrollment.
**Decision**: Ở mức Target Architecture (Phase 01B), domain `visa` tạm được coi là nơi sở hữu toàn bộ dữ
liệu Visa + Pre-departure + Enrollment (checklist con của Visa/Case). Quyết định có cần tách entity riêng
(VD: `EnrollmentRecord`) hay mở rộng entity `Visa` sẽ được chốt cụ thể khi triển khai Phase 09 (Visa),
dựa trên chi tiết field cần thiết lúc đó.
**Reason**: SRS không cung cấp entity riêng; không tự tạo entity mới ngoài Data Model đã chuẩn hóa ở
Phase 01. Việc chốt field cụ thể thuộc phạm vi Phase 09, không phải Phase 01.
**Affected modules**: 09-visa.

---

## ASM-04 — One Role per User (no User↔Role many-to-many)

**Date**: 2026-08-18
**Context**: Phase 02 Database Foundation needed to decide the User–Role cardinality.
SRS 6.1 describes role/permission as configurable but never states whether a user may hold
more than one role simultaneously. `00_MASTER_CONTEXT.md` Core Entities lists `User`,
`Role`, `Permission` but **no** `UserRole` join entity — only `RolePermission`.
**Decision**: `users.role_id` is a single required foreign key to `roles.id` (one role per
user), not a many-to-many join table.
**Reason**: The absence of a `UserRole` entity in the authoritative Core Entities list is
itself a signal — adding a many-to-many join table would be inventing an entity beyond
what MASTER_CONTEXT enumerates (Hard Rule "Không tạo entity trùng tên hoặc trùng ý nghĩa" /
general instruction "Không tự suy diễn requirement nếu tài liệu đã quy định"). If a future
phase surfaces a genuine multi-role requirement from the SRS/workbook, this should become a
tracked decision in `docs/DECISIONS.md`, not a silent schema change.
**Affected modules**: 02-foundation (schema), 03-security (RBAC will read this single
`role_id`, not aggregate across multiple roles).

---

## ASM-05 — `Student.portalUserId` / `StudentContact.portalUserId` added to enforce "Student self" / "Parent-linked student" scope

**Date**: 2026-08-18
**Context**: `03-security/02_RBAC.md` explicitly requires implementing "Student self" and
"Parent-linked student" as RBAC scope kinds. Neither the Phase 02 schema nor the 40 Core
Entities list (`00_MASTER_CONTEXT.md`) contains any link from `User` to `Student`/
`StudentContact` — without one, "self" and "parent-linked" scope cannot be evaluated at
all (there would be no way to know which Student a STUDENT_PARENT-role User represents).
**Decision**: Added `students.portal_user_id` (nullable, unique FK to `users.id`) and
`student_contacts.portal_user_id` (same shape) via migration
`20260818110122_auth_session_mfa_scope_links`. Both nullable — most Student/StudentContact
rows have no portal account at all (staff-entered, no login yet); only rows representing
an actual student-portal or parent-portal login get one set.
**Reason**: This is the minimal schema addition that makes an explicitly-required RBAC
scope kind actually enforceable, not a new business entity — no new table, just two FK
columns on entities that already exist. Consistent with the pattern already used in Phase
02 for `DocumentAccess` (add only what a named requirement cannot be satisfied without).
**Affected modules**: 03-security (ScopePolicyService), 04-core-crm (Student/StudentContact
creation will need to decide when/how a portal account gets linked — likely at Phase 11
Portal onboarding, not at Phase 04 creation time), 11-portal.

---

## ASM-06 — DEPARTMENT_MANAGER's "Department/team scope" approximated as GLOBAL

**Date**: 2026-08-18
**Context**: `03-security/02_RBAC.md` names "Department/team scope" as a scope kind to
implement, and SRS section 3 describes Trưởng phòng's scope as "Bộ phận/case quản lý"
(the department/cases they manage). No `Department` entity exists anywhere — not in the
40 Core Entities list, not in the Phase 02 schema, and SRS's own gap list (section 14)
never flags a missing Department entity either (unlike Case, Lead, etc., which it
explicitly calls out). There is also no `managerId`/`departmentId` column on `User` to
derive a manager's team from.
**Decision**: `ScopePolicyService` maps `DEPARTMENT_MANAGER` to `ScopeKind.GLOBAL` — same
scope as `EXECUTIVE_DIRECTOR` for Student/Case record access — distinguished from
`EXECUTIVE_DIRECTOR` only by which *permissions* are granted (see
`docs/security/RBAC_MATRIX.md`), not by a narrower record-scope filter.
**Reason**: Inventing a `Department` entity now, unprompted by any phase's instructions or
by SRS's own explicit gap list, would violate "Không tự suy diễn requirement nếu tài liệu
đã quy định" and the Hard Rule against inventing entities beyond what's defined. A
same-shaped precedent from Phase 01 already exists (`docs/architecture/DECISIONS.md`
ARCH-DEC-02 gluing "Counseling"/"Profile Development" together rather than inventing a
boundary the source material doesn't define). If a real multi-department partition is
ever required, it needs its own entity + migration in whichever phase actually specifies
it — this is a known, explicitly-flagged limitation, not a silently narrowed scope.
**Affected modules**: 03-security (ScopePolicyService, RBAC_MATRIX.md), any future phase
that introduces real department/team structure.

---

## ASM-07 — SRS §13's three-level field access ("V" / "Hạn chế" / "Không") collapsed to a binary allow/redact

**Date**: 2026-08-18
**Context**: SRS section 13's role×field matrix for Budget/Finance (and the other
sensitive field groups) uses three grant levels per role — full ("V"), restricted ("Hạn
chế"), and none ("Không") — but never defines what "Hạn chế" narrows down to (a numeric
range? a rounded/bucketed value? visible but flagged?).
**Decision**: `FieldPolicyService` treats "V" and "Hạn chế" as fully visible, and only
"Không" as redacted (nulled out in the response). For Budget/Finance specifically: visible
to EXECUTIVE_DIRECTOR, DEPARTMENT_MANAGER, CONSULTANT, ADMIN_FINANCE, STUDENT_PARENT
(own record only, via scope); redacted for DOCUMENT_SPECIALIST, SALES_MARKETING (moot —
has no `students:view` grant at all), SYSTEM_ADMIN (same).
**Reason**: SRS does not specify what "restricted" means precisely enough to implement a
finer-grained rule, and building a speculative one (e.g. "round to nearest $10,000") would
be inventing a business rule SRS never stated. A binary allow/redact is the smallest
faithful reading of the matrix that is actually implementable, and is documented here so a
future phase can replace it with something more precise once the source material defines
"Hạn chế" concretely.
**Affected modules**: 03-security (FieldPolicyService), any later phase exposing the
other SRS §13 field groups (passport, contract value, payment/debt, commission, visa
evidence) through a real endpoint.

---

## ASM-08 — No admin UI for audit log query/filter; the API is the Phase 03 deliverable

**Date**: 2026-08-18
**Context**: `03-security/03_AUDIT.md` says "Build query/filter UI for authorized admins."
No frontend application (`apps/web` or equivalent) has been bootstrapped in this
repository at any phase so far — Phase 01/02 are backend/database-only by their own
instruction files, and no phase file before this one has asked for a frontend to be
created.
**Decision**: Implemented `GET /audit-logs` with full filter (actor, action, objectType,
objectId, studentId, caseId, result, date range) + pagination/sort — i.e., everything a UI
screen would call — and did not bootstrap a new frontend application to build that screen
in this phase.
**Reason**: Standing up a frontend app from scratch (framework choice, build tooling,
routing, design system — none of which any prior phase has decided) is a disproportionate,
unrequested scope expansion to satisfy one line of one phase's instructions, and would
duplicate work if a later phase (Portal, Phase 11; or Platform/Reporting, Phase 12) makes
different frontend-architecture choices. The query/filter *capability* — the part that is
genuinely security-relevant (can only an authorized admin retrieve audit data, is it
correctly filterable) — is fully implemented and tested.
**Affected modules**: 03-security (AuditLogsController is the finished piece), whichever
phase first bootstraps `apps/web` will wire a screen to this existing endpoint.

---

## ASM-09 — STUDENT_PARENT granted `students:view` but not `students:edit` in this phase

**Date**: 2026-08-18
**Context**: SRS section 6.3 says "Cho phép student/PHHS cập nhật dữ liệu thuộc quyền; dữ
liệu thay đổi nhạy cảm có thể yêu cầu staff verification" — i.e. self-service editing is a
real requirement, but only for some fields, with sensitive changes needing staff
verification. Which fields are self-editable vs. staff-verified is not specified in SRS
section 13's matrix (that matrix covers *view* access, not *edit* granularity).
**Decision**: The Phase 03 permission seed does not grant `students:edit` to
STUDENT_PARENT at all — self-service profile editing is not reachable through
`PATCH /students/:id` by that role in this phase.
**Reason**: Implementing a field-by-field self-edit policy (which fields are open, which
require a staff-verification workflow) is real business/product logic SRS does not specify
precisely enough to build now, and belongs naturally to Phase 11 (`11-portal/
01_STUDENT_PARENT_PORTAL.md`) where the self-service portal itself is built — building a
partial, guessed version of it here would be inventing a business rule ahead of the phase
that owns it.
**Affected modules**: 03-security (permission seed), 07-profile (which fields even exist
to edit are largely added there), 11-portal (owns the actual self-service edit UX and
staff-verification workflow).

---

## ASM-10 — "Notes" (Lead/Student/Case) reuse `Comment`; only "create + list", not full Comment CRUD, built in Phase 04

**Date**: 2026-08-18
**Context**: `04-core-crm/01_LEAD.md` requires a `notes` field on Lead; `02_STUDENT_CASE.md`
requires a "timeline" for both Student 360 and Case. Phase 03's RBAC_MATRIX.md had
recorded `Comment` CRUD as "Phase 06 (Operations) scope; that phase should call this
rather than reinvent it" — Phase 04 needs *some* note-taking capability now, ahead of that
plan.
**Decision**: Added `POST .../notes` (create) on Lead/Student/Case, backed directly by the
existing `Comment` table (`entityType`/`entityId`), plus a `GET .../timeline` that merges
`Comment` rows with `AuditLog` rows for the same entity. Did NOT build a generic public
`/comments` CRUD surface (no update/delete, no threading/mentions) — that fuller feature
set remains Phase 06 scope, per the original plan.
**Reason**: `Comment` already exists precisely for this (Hard Rule: no duplicate entity/
concept — inventing a `Note` entity or a raw `notes` text column on Lead would duplicate
it). The minimum slice needed to satisfy 04-core-crm's explicit "notes"/"timeline"
requirement is create+list, not the full lifecycle Phase 06 will eventually own. This
revises (not contradicts) the Phase 03 RBAC_MATRIX.md note — recorded here so the "Phase 06
owns Comment CRUD" statement isn't read as "Phase 04 must not touch Comment at all."
**Affected modules**: 04-core-crm (`modules/notifications/comments/comments.service.ts`,
first slice), 06-operations (owns the rest: update/delete, threading, mentions).

---

## ASM-11 — `Lead.convertedStudentId` is not unique (a real bug found and fixed during Phase 04's own testing)

**Date**: 2026-08-18
**Context**: The Phase 02 schema declared `Lead.convertedStudentId` as `@unique`. Phase
04's own duplicate-detection/merge flow (SRS 6.2, 04-core-crm/01_LEAD.md) legitimately lets
a SECOND Lead (e.g. a duplicate inquiry from the same family) resolve to a Student that a
FIRST Lead already converted to — `apps/api/test/lead-conversion.e2e-spec.ts`'s "merges
into the existing Student" test hit a real Postgres unique-constraint violation the moment
this was exercised against the actual database, not a hypothetical.
**Decision**: Removed the `@unique` constraint (kept a plain index for query performance);
`Student.leadOrigin Lead?` became `Student.leadOrigins Lead[]` to reflect the now-correct
1-to-many cardinality. Migration
`20260818131515_fix_lead_converted_student_not_unique`.
**Reason**: The original constraint modeled "one Student can only ever have been converted
from one Lead," which is false under the merge flow this same phase's instructions require
building. Fixing it here (rather than leaving it and special-casing around it) is the
correct data-model fix, not a workaround — full write-up in `docs/DECISIONS.md` DEC-03.
**Affected modules**: 04-core-crm (LeadsService.convert), any future phase reading
`Student.leadOrigins` should expect an array, not a single nullable relation.

---

## ASM-12 — Lead conversion (not Contract signing) is the Student+Case creation trigger in this phase

**Date**: 2026-08-18
**Context**: SRS 6.2 literally says "Khi hợp đồng được ký, hệ thống tạo Student ID, Case và
liên kết Contract" (Contract signing is the canonical trigger). `04-core-crm/01_LEAD.md`
instead says "Conversion: Lead → Student + Contract/Case as appropriate" and requires the
conversion flow (with duplicate detection) to be built in this phase. Contract business
logic (template selection, monetary approval, signing) is explicitly Phase 05
(`05-commercial/01_CONTRACT.md`) — not read, not implemented here.
**Decision**: `POST /leads/:id/convert` creates Student + Case directly (no Contract
record). `Case.contractId` stays `null` — Phase 05 is expected to link an existing Case to
a newly-created/signed Contract, not the other way around.
**Reason**: Building real Contract signing logic now would be implementing Phase 05
business rules ahead of that phase's own instruction file, which the phase boundary rules
forbid. 04-core-crm/01_LEAD.md explicitly asks for the conversion flow now, so deferring
Student+Case creation until Phase 05 exists would leave Phase 04's own explicit
requirement unmet. This is a deliberate reading of two documents that point at slightly
different trigger mechanics for the same overall lifecycle event, not a contradiction that
required stopping — both source documents agree Student+Case creation happens once
sufficient business commitment exists; they differ only on the precise trigger, and the
one that's buildable today (Lead conversion) is what SRS mục 16's own P1 roadmap groups
together anyway ("Lead, Contract, Payment, Student, Case, Task").
**Affected modules**: 04-core-crm (LeadsService.convert), 05-commercial (must wire
Contract-to-Case linkage without re-creating Student/Case).

---

## ASM-13 — Student Payment (`Payment`) is a strictly separate concept from Partner Commission

**Date**: 2026-08-18
**Context**: `05-commercial/02_PAYMENT.md` covers money the Student/family pays this
organization (installments, partial payment, refund, waiver). SRS also describes a
Partner-commission concept ("hoa hồng đối tác") that is explicitly a Phase 10 deliverable
(`PartnerStudentLink`, `CommissionRule`, `CommissionTransaction` — see schema.prisma's
"deferred to their owning phase" header comment, domain 10 in
`docs/architecture/DOMAIN_MAP.md`).
**Decision**: `Payment` in this phase's schema/service/controller only ever represents
Student-owed money. No commission math, no Partner-facing balance, no field on `Payment`
references a Partner. Commission is a wholly separate future entity, not a variant status
or type flag on this table.
**Reason**: These are two different economic relationships (org↔student vs. org↔partner)
that happen to both be "money owed on a Contract-like thing" — conflating them into one
table now, ahead of Phase 10's own instructions, would be inventing a business concept this
phase's instruction files never asked for.
**Affected modules**: 05-commercial (payments), future Phase 10 (partners commission) —
Phase 10 must not attempt to reuse `Payment` for commission; it owns its own entity.

---

## ASM-14 — Refund is recorded on the same `Payment` row, not a separate transaction row

**Date**: 2026-08-18
**Context**: `05-commercial/02_PAYMENT.md` rule "Refund phải có liên kết tới payment gốc"
(a refund must be linked to the original payment) does not specify the storage shape —
neither a dedicated `Refund`/`PaymentTransaction` ledger table nor a same-row model is
named in the instruction file.
**Decision**: `Payment` gained `refundedAmount`/`refundedAt`/`refundedById`/`refundReason`
columns instead of a separate table. `PaymentsService.refund()` writes onto the same row,
supports partial refund (`refundedAmount < paidAmount`), and only flips `status` to
`REFUNDED` once the full net-paid amount has been returned.
**Reason**: The strongest possible "link to the original payment" is identity, not a
foreign key to a second row — there is exactly one row to look at for a payment's full
paid/refunded state, and no risk of a refund row surviving after its parent payment is
deleted (payments are never hard-deleted, but the general principle holds). A full
transaction ledger (every partial payment and refund as its own append-only row) is a
reasonable alternative design but is more than 05-commercial's own field list
("paid_amount", not "list of amounts paid") asks for.
**Affected modules**: 05-commercial (Payment/refund). A future phase wanting a full
transaction history would need a new ledger entity — this design does not preclude that,
it just doesn't build it now.

---

## ASM-15 — Case↔Contract linkage completes at `sign()`, not at Contract creation

**Date**: 2026-08-18
**Context**: SRS 6.2's literal Contract-signing trigger ("Khi hợp đồng được ký... liên kết
Contract") was deferred to this phase by ASM-12. `05-commercial/01_CONTRACT.md` requires
"Nếu Phase 04 để Case.contractId chưa được liên kết, Phase 05 phải hoàn thiện relationship
này đúng theo business rule," and also requires Contract creation to never create a new
Student or Case.
**Decision**: `ContractsService.create()` requires an existing Student and creates no Case.
`ContractsService.sign()` (SENT → SIGNED) looks up the Student's single active
(non-CLOSED/ARCHIVED) Case and sets `Case.contractId` in the same transaction that marks
the Contract SIGNED. No active Case → 409 `NO_ACTIVE_CASE_FOR_STUDENT` (the sign is
rejected, not silently completed without linkage, and a new Case is never auto-created to
route around it).
**Reason**: This is the only point in the Contract lifecycle where "the contract is now a
real, binding commitment" is actually true — DRAFT/REVIEW/APPROVED/SENT contracts are all
still provisional and linking a Case to a not-yet-signed Contract would let an abandoned
draft leave a stale link behind.
**Affected modules**: 05-commercial (Contract.sign, Case.contractId). Assumes each Student
has at most one Case eligible to receive a Contract at sign time — SRS gives no rule for
a Student with two simultaneously active Cases; that scenario surfaces `CASE_ALREADY_LINKED`
if the picked Case already has a different Contract, rather than silently overwriting it.

---

## ASM-16 — Task reuses Student/Case's `ROLE_SCOPE`, not a fourth scope map; STUDENT_PARENT gets zero `tasks:*` grant

**Date**: 2026-08-18
**Context**: `06-operations/01_TASK.md`: "Các task phải thuộc đúng Student/Case scope" —
this names an existing scope concept (Student/Case), not a new Task-specific one, unlike
Lead (`LEAD_ROLE_SCOPE`) and Contract/Payment (`CONTRACT_ROLE_SCOPE`), which the
instruction files for those phases explicitly required to differ per role from
Student/Case scope.
**Decision**: `ScopePolicyService.taskListFilter`/`assertTaskAccessible` call the existing
`scopeKindFor` (`ROLE_SCOPE`) directly — no new `TASK_ROLE_SCOPE` map. Within that,
STUDENT_PARENT is granted **zero** `tasks:*` permission at all (Task Engine is internal
staff tooling in this phase) — a task's free-text `blocker`/`output` fields are the same
class of internal-commentary content SRS §13 already restricts from Student/Parent as
"Internal notes" (enforced today via `Comment.visibility`), and nothing in
06-operations/01_TASK.md or 02_NOTIFICATION.md asks for a student-facing task view.
DOCUMENT_SPECIALIST is granted the same `tasks:view/create/edit/assign` as CONSULTANT
(full parity) even though it is narrower than CONSULTANT on Case management itself (no
`cases:edit/assign/close`) — Task *execution* (do the work assigned to you, hand it off if
needed) is a different capability than Case *management* (own/run the case), and
`TasksService.requireManageable` already prevents a non-case-owner from managing anyone
else's task regardless of the base grant, so the base permission alone doesn't expand
DOCUMENT_SPECIALIST's real reach.
**Reason**: Inventing a fourth scope map when the instruction file's own wording points at
an existing one would be adding structure the phase didn't ask for; reusing `ROLE_SCOPE`
is the minimal, correct reading. STUDENT_PARENT exclusion is the conservative default
(deny access to an ambiguous case rather than risk leaking internal work-tracking
commentary) — the same "safer default when unstated" reasoning already applied to
Contract/Payment field redaction in Phase 05.
**Affected modules**: 06-operations (Task). A future phase adding a student-facing task
view (e.g. a simplified "what's happening with my application" summary) would need its own
explicit grant and a redacted projection, not a loosening of this one.

---

## ASM-17 — A CANCELLED prerequisite satisfies Task completion, same as DONE

**Date**: 2026-08-18
**Context**: `06-operations/01_TASK.md`: "xử lý dependency khi task bị Cancelled," "completion
phải kiểm tra prerequisite nếu được quy định" — neither line says whether a cancelled
prerequisite blocks the dependent task forever or is treated as resolved.
**Decision**: `TasksService.updateStatus`'s DONE-transition prerequisite check treats a
prerequisite as satisfied when its status is DONE **or** CANCELLED — only a prerequisite
still NOT_STARTED/IN_PROGRESS/BLOCKED blocks completion (`409 PREREQUISITE_NOT_DONE`).
**Reason**: A cancelled prerequisite is, by definition, never going to become DONE —
treating it as still-blocking would make the dependent task permanently uncompletable,
which is a worse outcome than the alternative and matches ordinary project-management
semantics ("this step won't happen, don't let it wedge everything behind it").
**Affected modules**: 06-operations (Task, TaskDependency). Nothing needs to un-cancel a
prerequisite retroactively to unblock dependents — this is a read-time interpretation, not
a write-time cleanup.

---

## ASM-18 — Notification dispatch is synchronous; no queue/scheduler exists yet (Phase 12 scope)

**Date**: 2026-08-18
**Context**: `docs/architecture/TARGET_ARCHITECTURE.md` section 5 names Redis/BullMQ as
the intended queue for notification dispatch and rule-based reminder scheduling, but
`docs/PHASE_MAP.md` places "Documents + Jobs + Reporting" at Phase 12, and no queue/worker
infra exists anywhere in this repository yet (mirrors the same gap already noted for
`IdempotencyKey` cleanup in `docs/api/API_CONVENTIONS.md` section 9). 06-operations/
02_NOTIFICATION.md asks for reminder cadences (30/14/7/3/1 days, "Overdue daily") and
"Use queue/background worker if existing architecture supports it" — conditional on infra
that does not exist.
**Decision**: `NotificationsService.notify()` writes the `Notification` row synchronously,
in the same request that triggers the event — no queue. IN_APP is considered delivered the
instant the row exists (`sentAt = now`, since the inbox itself is the delivery mechanism);
EMAIL has no real SMTP/provider wired up, so its `sentAt` stays `null` (honestly recording
"queued conceptually, not actually dispatched" rather than claiming a send that didn't
happen). The reminder cadences themselves are implemented as callable, idempotent domain
methods (`TasksService.generateDeadlineReminders`/`generateOverdueReminders`,
`PaymentsService.generateOverdueReminders`) with a narrow manually-triggerable endpoint
(`POST /tasks/reminders/run`, `POST /payments/reminders/run`, both SYSTEM_ADMIN/
EXECUTIVE_DIRECTOR-gated) standing in for the not-yet-built scheduler.
**Reason**: Building actual Redis/BullMQ wiring now would be implementing Phase 12
infrastructure ahead of that phase's own instructions — the phase-boundary rule that
already governed ASM-12/ASM-15's Contract-vs-Lead-conversion timing question applies the
same way here. The domain logic (what to send, to whom, deduped how) is real Phase 06
scope and is fully built; only the "runs automatically on a timer" half is deferred.
**Affected modules**: 06-operations (Task/Payment reminder generation, Notification
dispatch). Phase 12 wiring a real scheduler should call these same service methods on a
cron rather than reinventing the reminder logic — and should replace the EMAIL-channel
no-op with an actual provider call, at which point `sentAt` starts getting set for real.

---

## ASM-19 — Task auto-generation fires at most once per (template, source entity), even across repeat real-world occurrences

**Date**: 2026-08-18
**Context**: `06-operations/01_TASK.md`: "Nếu event/API bị retry, task generation phải
idempotent." `Task`'s dedup key is `(templateId, sourceEntityType, sourceEntityId)` — for
`CASE_STAGE_CHANGED`, `sourceEntityId` is the Case's own id (not, say, a per-occurrence
event id), so a Case that legitimately re-enters the same `stage` value a second time later
in its lifecycle will NOT generate a second task from the same template.
**Decision**: Accept this as the intended behavior, not just a retry-safety side effect — a
given template generates **at most one** task per source entity, ever.
**Reason**: The instruction's literal ask is about retries, but the overwhelmingly common
real intent behind "generate a task when Case enters stage X" is "make sure this onboarding-
style task exists once," not "spawn a fresh task every time the case happens to pass through
that stage again" — the latter would itself violate the spirit of "không tạo duplicate task"
if a case's stage naturally oscillates (e.g. sent back for revision, then re-advances).
**Affected modules**: 06-operations (TaskTemplate, TaskGenerationService). A future phase
wanting genuinely repeatable per-occurrence generation would need a distinguishing
per-occurrence source id (e.g. include a timestamp/sequence in `sourceEntityId`), not a
change to this dedup mechanism.

---

## ASM-20 — Every Phase 07 Counseling entity reuses `assertCaseAccessible` directly; no new scope map

**Date**: 2026-08-19
**Context**: `07-profile/01_ASSESSMENT_ROADMAP.md`/`02_PROFILE_EVIDENCE.md`: "Assessment
phải thuộc đúng Student/Case scope," and the equivalent wording for every other Phase 07
entity — all of them name the existing Student/Case scope concept, the same pattern ASM-16
already established for Task.
**Decision**: Assessment, AssessmentCriterion (via its parent), Roadmap, RoadmapMilestone
(via its parent Roadmap), AcademicRecord, TestRecord, Competition, ResearchProject,
Activity, WritingArtifact (and WritingVersion/LOR via their parent case) all carry their
own `caseId` and call `ScopePolicyService.assertCaseAccessible` directly — no
`ASSESSMENT_ROLE_SCOPE`/`WRITING_ROLE_SCOPE`/etc. map was added.
**Reason**: Ten near-identical new scope maps, each a copy of `ROLE_SCOPE`, would be pure
duplication with no behavioral difference — the same "don't invent structure the phase
didn't ask for" reasoning as ASM-16, extended to every entity this phase adds rather than
re-litigated per entity.
**Affected modules**: 07-profile (all of Counseling). A future phase giving one of these
entities a genuinely different scope shape (e.g. a Writing artifact visible beyond its own
case) would need its own map at that point, not a retrofit of this one.

---

## ASM-21 — Grouped permission resources: `profile_evidence` (5 entities) and `writing` (3 entities), not one resource per entity

**Date**: 2026-08-19
**Context**: 07-profile splits into three instruction files, and `02_PROFILE_EVIDENCE.md`
itself groups AcademicRecord/TestRecord/Competition/ResearchProject/Activity under one
file title ("Profile Evidence"); `03_WRITING.md` groups WritingArtifact/WritingVersion/LOR
under "Writing" (LOR is explicitly listed alongside Resume/Essay/SOP as one of the
"Implement:" types, not called out as separate).
**Decision**: `database/seeds/seed.ts`'s permission matrix uses `profile_evidence`
(view/create/edit) as one resource covering all five evidence entities, and `writing`
(view/create/edit) covering WritingArtifact/WritingVersion/LOR — not ten-plus separate
resource names.
**Reason**: These five (and three) entities share an identical CRUD/scope/RBAC shape and
are always granted identically per role in this phase's design (a role that can touch one
Profile Evidence entity touches all five) — a resource-per-entity matrix would be pure
repetition in `GRANTS` with zero behavioral difference, and would directly contradict the
instruction files' own file-level grouping.
**Affected modules**: 07-profile. A future phase that needs to grant one of these five (or
three) entities differently from its siblings would need to split the resource at that
point — not before, since nothing in this phase's instructions asks for that distinction.

---

## ASM-22 — `RoadmapMilestoneDependency` is a separate table from `TaskDependency`, not reused

**Date**: 2026-08-19
**Context**: `07-profile/01_ASSESSMENT_ROADMAP.md` lists "dependencies" and "task
linkage" as two separate checklist items for Milestone, and explicitly forbids
duplicating Task's entity/workflow ("Không tạo Task implementation mới... Không duplicate
Task entity hoặc workflow").
**Decision**: Milestone-to-milestone sequencing is its own table
(`RoadmapMilestoneDependency`, same shape as `TaskDependency` — self/circular rejection,
DONE-or-CANCELLED completion gate — but a distinct table), while a Milestone's actual
execution work items are ordinary `Task` rows tagged via the new `Task.milestoneId`
column, created exclusively through the existing `TasksService.createForCase`.
**Reason**: A Milestone is a planning unit (can carry many Tasks); "Milestone B can't
start until Milestone A is done" is a roadmap-planning-level concern, not the same concept
as "Task B can't start until Task A is done" (execution-level). Reusing `TaskDependency`
directly for Milestone rows would require sharing rows between two different owning
entities' idempotency/authorization models — that would be a real hazard, not a
simplification; a small, structurally-identical-but-independent table is the honest
representation of "these are two different graphs by coincidence of shape."
**Affected modules**: 06-operations (`Task.milestoneId`, additive), 07-profile
(`RoadmapMilestoneDependency`).

---

## ASM-23 — A minimal, metadata + grant-based Documents module is built now, not deferred entirely to Phase 12

**Date**: 2026-08-19
**Context**: `docs/PHASE_MAP.md` places "Documents + Jobs + Reporting" at Phase 12; Phase 06
(`docs/phase-status/PHASE_06.md`) explicitly noted "No Document controller exists yet
(Phase 12)." But `07-profile/02_PROFILE_EVIDENCE.md`: "Mọi evidence phải link tới Document
theo architecture hiện tại... Kiểm tra: document permission, student access, staff access,
case scope, download permission, audit... Không tạo public file URL" — and the phase's own
testing checklist explicitly requires ALLOW/DENY tests for "document download."
**Decision**: Built `modules/documents/documents/` — `Document` row creation (metadata
only, `fileReference` is a caller-supplied opaque key, same "reference, not a live file
pipe" idea as `Contract.signedDocumentId` in Phase 05), `GET /documents/:id`, and
`GET /documents/:id/download` (returns the stored `fileReference` after a real
authorization check, never a public URL). Access is grant-based: `DocumentsService.
grantCaseAccess` inserts `DocumentAccess` rows (VIEW+DOWNLOAD) for every current CaseMember
plus the linked student/parent portal users, called by each Phase 07 evidence/writing
service immediately after linking a `evidenceDocumentId`/`documentId`. Real object-storage
upload, virus/malware scanning, and signed-URL issuance remain Phase 12 scope — not built.
**Reason**: The instruction file explicitly demands a real, tested authorization gate on
document download, not just a schema field — building only the FK reference (Phase 05's
treatment) would leave "document permission... download permission phải qua authorization"
untestable and unbuilt. Building the FULL Phase 12 storage/virus-scan/signed-URL pipeline
now would be implementing that phase's own instructions ahead of time. This is the same
"buildable slice now, infra-heavy remainder deferred with a paper trail" pattern already
used for Notification dispatch (ASM-18) and the Task/Payment reminder sweep.
**Affected modules**: 07-profile (all evidence/writing links), Documents (new domain,
first real slice). Phase 12 should extend `DocumentsService`, not replace it — `create`'s
`fileReference` contract and `DocumentAccess`-based authorization should carry forward
once real storage exists.

---

## ASM-24 — Phase 07 evidence/writing `documentId` fields are real Prisma FK relations, not plain string references

**Date**: 2026-08-19
**Context**: `docs/ASSUMPTIONS.md` ASM-02 (Phase 05) deliberately made
`Contract.signedDocumentId` a plain string, not a FK, specifically because no Document
controller/service existed yet at that time.
**Decision**: `AssessmentCriterion.evidenceDocumentId`, `RoadmapMilestone.
evidenceDocumentId`, `AcademicRecord/TestRecord/Competition/ResearchProject/
Activity.evidenceDocumentId`, `WritingVersion.documentId`, and `LetterOfRecommendation.
evidenceDocumentId` are all real `@relation` foreign keys to `Document`.
**Reason**: This does not contradict ASM-02 — it reflects a change in circumstance, not a
change of mind: ASM-23 (above) means Phase 07 is the phase that actually stands up a real,
permission-checked Document read path, so a genuine FK is now both possible and correct
(referential integrity, easy `include`), unlike Phase 05 where no owning service existed
to make a FK meaningful.
**Affected modules**: 07-profile (every evidence/writing model), Documents.

---

## ASM-25 — Phase 07 RBAC: separation of duties on approval, STUDENT_PARENT view-only, DOCUMENT_SPECIALIST narrower on counseling but full on Documents

**Date**: 2026-08-19
**Context**: `07-profile`'s RBAC/SECURITY section names roles but not a full grant table:
"Consultant được truy cập Assessment/Roadmap/Profile/Writing trong phạm vi case,"
"Application/Document Specialist không tự động có quyền sửa mọi counseling/profile data
nếu RBAC không cho phép," "Student/Parent chỉ xem và chỉnh những field/document được
phép," "Sales/Marketing không tự động nhìn thấy dữ liệu profile nhạy cảm." The concrete
grant matrix had to be filled in.
**Decision**: (1) CONSULTANT gets `view/create/edit` on `assessments`/`roadmaps`/
`profile_evidence`/`writing` but never `approve` — only EXECUTIVE_DIRECTOR/
DEPARTMENT_MANAGER hold `assessments:approve`/`roadmaps:approve`, mirroring Contract's
Phase 05 approval separation (the person building the plan doesn't self-approve it).
(2) STUDENT_PARENT gets `view` only across all five Phase 07 resources, scoped to its own
case (OWN_STUDENT via the reused `ROLE_SCOPE`) — no `create`/`edit`, extending ASM-09's
"self-service editing is Phase 11 Portal work" precedent to this phase's new entities too.
(3) DOCUMENT_SPECIALIST gets `view` only on `assessments`/`roadmaps`/`profile_evidence`/
`writing` (its SRS domain is Document/Application/Scholarship/Visa, not counseling) but
full `view/create/download` on the new `documents` resource (Document genuinely IS its
domain). (4) SALES_MARKETING/ADMIN_FINANCE/SYSTEM_ADMIN get zero grant on all five —
consistent with their existing zero-grant treatment on Student/Case.
**Reason**: Each of these is a direct, literal application of a specific instruction
sentence (approval separation, Document-Specialist narrowing, Student/Parent view-only,
Sales/Marketing exclusion) rather than an invented rule — recorded here because the
instruction file names the *principle* without spelling out the resulting permission rows.
**Affected modules**: 07-profile (all), `database/seeds/seed.ts`, `docs/security/
RBAC_MATRIX.md`.

## ASM-26 — Phase 08 master-data business-ID formats invented (UNI/PRG/SCHM); Offer/UniversityChoice/ApplicationChecklist get no business code

**Date**: 2026-08-19
**Context**: `00-context/00_MASTER_CONTEXT.md`'s ID-format table defines `APP-YYYY-NNNNN`
(Application) and `SCH-YYYY-NNNNN` (Scholarship Application) explicitly, but is silent on
University/Program/ScholarshipMaster — even though Phase 02's foundation schema already
gave all three a required, unique `*_code` column (`universityCode`/`programCode`/
`scholarshipCode`) that Phase 08 is the first phase to actually populate. It is also
silent on Offer/UniversityChoice/ApplicationChecklist entirely.
**Decision**: University/Program/ScholarshipMaster use the standard `nextYearlyCode`
generator with invented-but-reasonable prefixes: `UNI-YYYY-NNNNN`, `PRG-YYYY-NNNNN`,
`SCHM-YYYY-NNNNN` (the extra `M` deliberately disambiguates from `SCH-YYYY-NNNNN`,
already reserved for Scholarship *Application*). Offer, UniversityChoice, and
ApplicationChecklist get a plain UUID `id`, no business-code column at all — the same
"no format needed" treatment Phase 07 gave AssessmentCriterion/WritingVersion/
RoadmapMilestone: each is a sub-record of an already-coded parent (Application/Student),
not an independent master or transaction root.
**Reason**: Phase 02's schema commitment (a required unique code column) had to be
honored without a compelling reason to remove it — inventing a format was the only path
that didn't leave the column unpopulatable — but it had no source to copy from, so this is
recorded as an assumption rather than presented as if the master context specified it.
**Affected modules**: `apps/api/src/modules/admission/master-data/*.service.ts`,
`common/id/id-generator.service.ts` (no code change — existing `nextYearlyCode` reused).

## ASM-27 — `ownerId` fields are FK-less plain string pointers; no admissions-portal-credential storage was built

**Date**: 2026-08-19
**Context**: `University.ownerId` (08-admission/01_MASTER_DATA.md's "owner" field) and
`UniversityChoice.ownerId`/`ApplicationChecklist.ownerId` need to point at a staff User.
Separately, the phase orchestration prompt's FIELD-LEVEL SECURITY section warns against
ever storing a university-portal-login password in plaintext, and asks that if credential
storage isn't in scope, that be recorded as an assumption rather than worked around.
**Decision**: (1) Every `ownerId` above is a plain `String?` column with no Prisma
`@relation`/back-relation on `User` — the exact same "assigned-staff pointer, not a full
relation" pattern Phase 07 already established for `RoadmapMilestone.ownerId`, validated
(where it matters) at the service layer, not via a formal FK. (2) No admissions-portal
credential/secret field was added to `University`/`Program` at all — none of the three
08-admission instruction files ask for one; the phase orchestration prompt's warning is
conditional ("nếu credential cần lưu"), and since nothing requires storing one, the
correct response is to not build the feature, not to build a workaround.
**Reason**: (1) avoids ballooning `User`'s back-relation list for a field that's closer to
free-form staff assignment than a core aggregate relationship, consistent with existing
precedent. (2) building an unrequested credential-storage feature (even a "safe" one)
would be scope invention beyond what any instruction file asks for.
**Affected modules**: `database/schema.prisma` (`University`/`UniversityChoice`/
`ApplicationChecklist`), `apps/api/src/modules/admission/**`.

## ASM-28 — `UniversityChoice.caseId` stays nullable; `ScholarshipApplication.caseId` is required

**Date**: 2026-08-19
**Context**: 08-admission/01_MASTER_DATA.md's own UniversityChoice field list is
"student/program/tier/rationale/status" — no Case. The phase orchestration prompt's
cross-cutting "APPLICATION ↔ OFFER ↔ SCHOLARSHIP" section separately states "Liên kết phù
hợp: Student, Case, ScholarshipMaster, Program/Application nếu instruction yêu cầu" for
ScholarshipApplication specifically. `Application` itself (08-admission/02_APPLICATION.md)
explicitly requires Case.
**Decision**: `Application.caseId` and `ScholarshipApplication.caseId` are both required
(non-nullable); `UniversityChoice.caseId` stays nullable. Scope for UniversityChoice/
ScholarshipApplication is checked by whichever FK is actually set — `assertCaseAccessible`
when `caseId` is present, `assertStudentAccessible` otherwise — both already exist on
`ScopePolicyService`, no new scope map added.
**Reason**: A School Selection shortlist entry is, by nature, something counseling starts
proposing before a formal Case may even exist (early advising conversations); the
instruction file's own field list reflects that by omitting Case entirely. Application and
ScholarshipApplication are both explicitly Case-linked by their respective instruction
text, so tightening them to required is a direct, literal application, not an invented
requirement — and since zero rows existed for either table before this phase (confirmed
via row-count check), tightening was a safe, additive-in-spirit migration.
**Affected modules**: `database/schema.prisma`, `apps/api/src/modules/admission/
university-choices/**`, `.../scholarship-applications/**`.

## ASM-29 — `ApplicationChecklist` stays Application-only (not polymorphic); ScholarshipApplication's "documents"/"essay" reuse existing subsystems instead

**Date**: 2026-08-19
**Context**: `docs/architecture/DOMAIN_MAP.md` (written at Phase 01B, before Phase 08
started) already names `ApplicationChecklist` as its own specific Admission-domain entity.
08-admission/02_APPLICATION.md gives it a full field list (required/owner/deadline/
status/document/notes) under Application specifically. 03_OFFER_SCHOLARSHIP.md's
ScholarshipApplication field list separately includes "documents" and "essay," but with no
comparable full checklist-field-list treatment.
**Decision**: `ApplicationChecklist` stays a plain, non-polymorphic FK to `Application`
only — not generalized into a polymorphic `entityType`/`entityId` checklist reusable by
ScholarshipApplication too (which was considered and rejected, since DOMAIN_MAP.md already
fixed the entity's name/shape around Application specifically, and inventing a second
consumer wasn't asked for). ScholarshipApplication's "documents" need is satisfied by
`Document`'s own pre-existing polymorphic `ownerEntity`/`ownerId` fields (already designed
since Phase 02 for exactly this kind of multi-document attachment, no schema change
needed) rather than a duplicate checklist entity. Its "essay" need reuses the Phase 07
Writing subsystem (`essayArtifactId` → `WritingArtifact`, `type: "Scholarship Essay"` —
`WritingArtifact.type` was deliberately made free-text/configurable for exactly this kind
of extension) rather than a duplicate content field.
**Reason**: Each choice reuses an existing, purpose-built mechanism instead of duplicating
a business concept — "Không tạo duplicate entity hoặc duplicate business concept" — and
each is grounded in a real precedent already in the codebase, not an invented pattern.
**Affected modules**: `database/schema.prisma` (`ScholarshipApplication.essayArtifactId`,
`WritingArtifact.scholarshipEssayFor` back-relation), no `ApplicationChecklist` change.

## ASM-30 — Task Engine extension: `APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED` fire at the significant milestone, not every status change

**Date**: 2026-08-19
**Context**: `06-operations/01_TASK.md` (Phase 06's own instruction file) names
"application"/"scholarship" as auto-generation triggers, deliberately deferred in Phase 06
(ASM-16) since neither entity existed yet. `02_NOTIFICATION.md` likewise names
"application deadline"/"scholarship deadline" as deferred notification events. Neither
instruction file specifies exactly *which* Application/ScholarshipApplication transition
should be the trigger point.
**Decision**: Two new `TaskTemplateTrigger` values — `APPLICATION_SUBMITTED` (fires once
when an Application reaches SUBMITTED) and `SCHOLARSHIP_AWARDED` (fires once when a
ScholarshipApplication reaches AWARDED) — plus matching `NotificationsService` calls to
every current CaseMember on the same two transitions. Both reuse the exact Phase 06
idempotency mechanism (`Task`'s own unique constraint) and the Phase 06
`notifyBothChannels`/`dedupeKey` mechanism, no new dedup logic.
**Reason**: Mirrors the "fire once, at the single most significant milestone" scoping
already used for `CONTRACT_ACTIVATED` (not "every Contract status change") and
`ROADMAP_APPROVED` (not "every Roadmap status change") — Submitted and Awarded are the
Application/ScholarshipApplication analogues of those milestone moments. Deadline-based
reminders (the other named Phase 06 notification event) were not built this phase — no
instruction file in 08-admission asks for a reminder cadence, unlike Task/Payment's
explicit 30/14/7/3/1-day requirement in 06-operations — so building one here would be
unrequested scope.
**Affected modules**: `database/schema.prisma` (`TaskTemplateTrigger`), `apps/api/src/
modules/admission/applications/applications.service.ts`, `.../scholarship-applications/
scholarship-applications.service.ts`, `create-task-template.dto.ts`.

## ASM-31 — Phase 08 RBAC grant matrix: master-data curation separated from transaction permissions

**Date**: 2026-08-19
**Context**: The phase orchestration prompt's RBAC section states principles without a
grant table: "Consultant có thể làm application-related work trong case scope,"
"Application/Document Specialist có quyền xử lý hồ sơ nhưng không mặc nhiên có quyền tài
chính hoặc counseling nội bộ," "Sales/Marketing không mặc nhiên được xem application/
visa-sensitive data," "User có thể CREATE UniversityChoice nhưng không có quyền sửa
University master," "Consultant có thể sử dụng Program nhưng không nhất thiết được chỉnh
tuition."
**Decision**: Five resources — `admission_master` (view/create/edit/verify),
`university_choices`, `applications` (covers ApplicationChecklist too),
`offers`, `scholarship_applications` (each view/create/edit). CONSULTANT: `view` only on
`admission_master` (curation is ED/DM-only), full `view/create/edit` on the four
transaction resources (its case-scoped counseling-execution domain). DOCUMENT_SPECIALIST:
`view` on `admission_master`/`university_choices`/`offers`/`scholarship_applications`, full
`view/create/edit` on `applications` (its actual document-processing domain — checklist
management). SALES_MARKETING: `admission_master:view` only (a university's own published
catalog data, not student-linked) — zero on the other four (Student/Case-scoped
transaction data). STUDENT_PARENT: `view` only across all five, own case only — no
self-service accept/decline/confirm actions in this phase (extends ASM-09's "self-service
editing is Phase 11 Portal work" precedent). ADMIN_FINANCE/SYSTEM_ADMIN: zero grant
(Admission isn't their SRS-defined domain, consistent with their zero grant on Phase 07's
resources).
**Reason**: Each grant traces to one of the literal instruction sentences above; the
overall shape (5 grouped resources, matching each 08-admission file's own entity grouping)
mirrors ASM-21's precedent from Phase 07 rather than inventing 8 near-duplicate resources.
**Affected modules**: `database/seeds/seed.ts`, `docs/security/RBAC_MATRIX.md`.

## ASM-32 — Program tuition / Offer deposit / Scholarship award amounts are NOT subject to Contract/Payment-style financial-field redaction

**Date**: 2026-08-19
**Context**: SRS §13's Contract Value / Payment-Debt redaction rule (`FieldPolicyService.
redactContract`/`redactPayment`, Phase 05) hides fields for CONSULTANT/DOCUMENT_SPECIALIST/
SALES_MARKETING/SYSTEM_ADMIN. Phase 08 introduces several other money-shaped fields:
`Program.tuition`/`applicationFee`, `ScholarshipMaster.amount`/`percentage`,
`Offer.depositAmount`, `ScholarshipApplication.awardAmount`. The phase orchestration
prompt's FIELD-LEVEL SECURITY section asks to check "financial/fee-related fields nếu có"
for sensitivity.
**Decision**: None of these Phase 08 money fields are added to the `FINANCIAL_REDACTED_FOR`
redaction set. The only new field-level protection this phase adds is
`ScholarshipApplication.internalNotes`, redacted from STUDENT_PARENT
(`FieldPolicyService.redactScholarshipApplication`, same pattern as LOR's `internalNotes`).
**Reason**: SRS's Contract-Value/Payment-Debt redaction specifically protects the
*agency's own negotiated commercial terms* with a client — internal, sensitive-by-nature
figures. Program tuition, scholarship award amounts, and offer deposits are, by contrast,
third-party figures a university or scholarship provider sets and publishes/discloses
itself (a program's tuition is on the university's own public admissions page) — the same
category of "public reference/master data" as the rest of `admission_master`, not the
agency's private commercial position. Redacting them would also actively harm the roles
that most need them to do their job (a Consultant cannot advise on affordability without
seeing tuition). MD's own "Không trộn scholarship amount / student contract fee / tuition
payment / partner commission" instruction is about keeping these as SEPARATE fields/
tables (already true — no shared columns, no FK to Contract/Payment/Commission
anywhere), not about hiding them from view.
**Affected modules**: `apps/api/src/modules/identity/rbac/field-policy.service.ts`
(`redactScholarshipApplication` only), `docs/security/RBAC_MATRIX.md` section 5.

## ASM-33 — `VisaChecklistItem` is one polymorphic entity shared by Visa and Pre-Departure, deliberately not merged with Phase 08's `ApplicationChecklist`

**Date**: 2026-08-19
**Context**: `docs/architecture/DOMAIN_MAP.md` (written at Phase 01B) already anticipated
this exact situation: "checklist pre-departure/enrollment được model như checklist con
của Visa hoặc Case closure, xem ASSUMPTIONS nếu cần entity riêng khi vào Phase 09." Phase
09 needs checklist-item support for two distinct parents (a specific Visa attempt, and a
Case-level pre-departure milestone that outlives any one Visa attempt) that are otherwise
structurally identical to each other AND to Phase 08's `ApplicationChecklist`
(title/required/owner/deadline/status/document/notes/completedAt).
**Decision**: A single new `VisaChecklistItem` model, using the same polymorphic
`entityType`/`entityId` pattern already established for `Comment`/`Approval`/
`Document.ownerEntity` — `entityType = 'Visa'` (`entityId` = a `Visa.id`) or
`entityType = 'PreDeparture'` (`entityId` = a `Case.id`). It reuses Phase 08's
`ChecklistItemStatus` enum unchanged (not a duplicate enum). `ApplicationChecklist`
(Phase 08, already PASSed) is deliberately left untouched and NOT generalized into this
same polymorphic model, even though a fully-generic 3-consumer checklist entity was
considered.
**Reason**: Refactoring `ApplicationChecklist` now would mean rewriting an already-PASSed
Phase 08 migration/service/controller/test suite — real cross-phase risk for a purely
structural cleanup, not something Phase 09's instructions asked for ("Không rewrite các
phần đã PASS nếu không có lý do kỹ thuật bắt buộc"). Introducing ONE new shared entity for
the two NEW consumers being built together, in the same phase, is not the same risk
calculus — it avoids a third near-identical model without touching shipped work.
**Affected modules**: `database/schema.prisma` (`VisaChecklistItem`), `apps/api/src/
modules/visa/visas/visa-checklist.service.ts`, `.../pre-departure/pre-departure.service.ts`.

## ASM-34 — Visa business-ID format used (master-context-defined); checklist templates/items and Enrollment get none

**Date**: 2026-08-19
**Context**: `00-context/00_MASTER_CONTEXT.md`'s ID-format table explicitly defines
`VISA-YYYY-NNNNN`. It is silent on `VisaChecklistTemplate`, `VisaChecklistItem`, and
`Enrollment`.
**Decision**: `Visa.visaCode` uses `nextYearlyCode('VISA')`. `VisaChecklistTemplate`,
`VisaChecklistItem`, and `Enrollment` all get a plain UUID `id`, no business-code column —
the same "no format needed" treatment already applied to Phase 07/08 sub-record entities
(Offer, ApplicationChecklist, UniversityChoice, AssessmentCriterion, etc.).
**Reason**: `Enrollment` is structurally a transaction stemming from an Offer/Application,
not a top-level case-defining entity with its own master-context-reserved format —
directly analogous to Offer's own Phase 08 treatment (ASM-26).
**Affected modules**: `apps/api/src/modules/visa/visas/visas.service.ts`.

## ASM-35 — Visa FSM: dedicated data-carrying actions for Submitted/Appointment/Interview/Result; at-most-one-active-Visa-per-case; Interview is optional, not mandatory

**Date**: 2026-08-19
**Context**: 09-visa/01_VISA.md's status list (Not Started→Preparing→Ready→Submitted→
Appointment→Interview→Granted/Refused→Withdrawn) reads as a straight-line sequence, but
the phase orchestration prompt's own VISA WORKFLOW section clarifies each transition needs
its own precondition, and not every visa type requires an interview step in reality.
**Decision**: `SUBMITTED`/`APPOINTMENT`/`INTERVIEW`/`GRANTED`/`REFUSED` are each reachable
only via their own dedicated action (`submit`/`appointment`/`interview`/`result`), never a
bare `PATCH .../status` — mirroring Application/Offer's Phase 08 precedent exactly.
`GRANTED`/`REFUSED` are reachable directly from `SUBMITTED` or `APPOINTMENT`, not only from
`INTERVIEW` — an interview is a real step for many visa types but not universal (e.g. some
study-permit categories are decided without one). At most one non-terminal Visa per Case is
enforced at the service layer (`VisasService.assertNoActiveDuplicate`), the same "at most
one active X" precedent as Application (`docs/DECISIONS.md` DEC-05) — a Refused/Withdrawn
visa's row is never overwritten by a new attempt.
**Reason**: Each is a direct extension of an established, already-tested pattern rather
than an invented one, and "not every visa needs an interview" avoids hard-coding a
requirement the instruction text never actually states as universal.
**Affected modules**: `apps/api/src/modules/visa/visas/visas.service.ts`.

## ASM-36 — Closure preconditions: Payment/Visa/Enrollment/pre-departure checks are all conditional on that workflow having actually been engaged

**Date**: 2026-08-19
**Context**: 09-visa/02_PRE_DEPARTURE_ENROLLMENT.md: "Closure requires: valid completion/
reason, payment state handled, critical tasks resolved, enrollment/closure evidence as
applicable." The phase orchestration prompt elaborates with more groups (Contract status,
Visa/Departure state "nếu business rule yêu cầu", mandatory checklist) but hedges several
of them as conditional, and explicitly warns: "Nếu current SRS chỉ quy định một phần
closure checklist: triển khai đúng phần đã quy định, ghi assumption cho phần còn thiếu,
không tự invent business process."
**Decision**: `CasesService.close()` (Phase 04, extended) now additionally checks, each as
its own guard: (1) no unresolved Payment (PENDING/PARTIALLY_PAID/OVERDUE) on the Case's
linked Contract, unconditionally (a Case with no Contract at all has nothing to owe); (2)
no Visa in a non-terminal status, unconditionally (an open visa case is itself the "in
progress" signal — no separate opt-in needed, mirrors the existing open-Task guard); (3) a
CONFIRMED Enrollment, but ONLY if at least one Application exists for the Case (admission
was actually attempted) — a Case closed early, before ever reaching Admission, is never
blocked waiting for an Enrollment that was never applicable; (4) every REQUIRED
pre-departure checklist item DONE/WAIVED, but ONLY if at least one pre-departure item
exists for the Case — same conditional-applicability reasoning. No "reopen Closed Case"
action was built — Phase 04's own `CASE_TRANSITIONS` table (already PASSed) has no reverse
edge out of CLOSED, and no Phase 09 instruction explicitly asks for one despite the AUDIT
section's hedged mention ("reopen/unclose nếu business rule cho phép").
**Reason**: (1)/(2) are unconditional because they are true regardless of which workflow a
Case went through — money owed or an in-flight visa block closure no matter how the Case
got there. (3)/(4) are conditional because, unlike (1)/(2), Enrollment/pre-departure only
exist as concepts once Admission was actually pursued — making them unconditional would
incorrectly block a Case that was legitimately closed for an unrelated reason (e.g.
withdrawal) before ever reaching that stage, which would be inventing a requirement the
instruction text never states.
**Affected modules**: `apps/api/src/modules/case-management/cases/cases.service.ts`,
`apps/api/src/modules/visa/visa-status/visa-status.service.ts`, `apps/api/src/modules/
commercial/payments/payments.service.ts` (`hasOutstandingDebtForCase`).

## ASM-37 — Phase 09 RBAC grant matrix: master-data curation separated from case-scoped transaction permissions, mirroring Phase 08's ASM-31

**Date**: 2026-08-19
**Context**: The phase orchestration prompt's RBAC section states principles without a
grant table: "Consultant chỉ trong case scope," "Application/Document Specialist có quyền
hồ sơ theo scope," "Finance/Admin không mặc định được sửa visa counseling data," "Sales/
Marketing không mặc định được xem visa/identity/finance evidence," "Student/Parent chỉ
được truy cập dữ liệu của linked Student."
**Decision**: Four resources — `visa` (covers Visa + its Visa-scoped checklist items),
`visa_checklist_templates` (country+visa-type master data), `pre_departure`, `enrollment`
(each view/create/edit). CONSULTANT: `view` only on `visa_checklist_templates`
(curation is ED/DM-only), full `view/create/edit` on the three case-scoped resources.
DOCUMENT_SPECIALIST: full `view/create/edit` on `visa` and `pre_departure` (both
paperwork-heavy — passport/visa/flight/insurance evidence, its actual document-processing
domain), `view`-only on `enrollment` (a counseling commitment decision, not paperwork) and
`visa_checklist_templates`. SALES_MARKETING: zero grant on the three sensitive
transaction resources, `visa_checklist_templates:view` only (checklist titles like
"Passport copy" are non-sensitive catalog data). ADMIN_FINANCE: zero grant on all four —
consistent with its established zero-grant treatment on every Phase 07/08 counseling/
admission resource, even though the literal instruction text only says "không được sửa"
(not edit) rather than a blanket exclusion; kept conservative for consistency with
precedent. STUDENT_PARENT: `view` only across all four, own case only — no self-service
submit/confirm/withdraw actions in this phase (extends ASM-09's "self-service editing is
Phase 11 Portal work" precedent). SYSTEM_ADMIN: zero grant.
**Reason**: Each grant traces to one of the literal instruction sentences above; the
overall shape (4 grouped resources, matching each 09-visa file's own entity grouping)
mirrors ASM-21/ASM-31's precedent rather than inventing 8+ near-duplicate resources.
**Affected modules**: `database/seeds/seed.ts`, `docs/security/RBAC_MATRIX.md`.

## ASM-38 — Field-level redaction scope: only `internalNotes`; appointment/interview/result/reason stay visible to the affected Student/Parent

**Date**: 2026-08-19
**Context**: 09-visa/01_VISA.md's SENSITIVE VISA DATA section lists many groups needing
protection: "passport, identity documents, financial evidence, visa forms, visa
appointment details, interview details, internal visa notes, refusal reason nếu thuộc
field nhạy cảm."
**Decision**: Only `Visa.internalNotes` and `Enrollment.internalNotes` are field-level
redacted (from STUDENT_PARENT), via `FieldPolicyService.redactVisa`/`redactEnrollment` —
same pattern as LOR/ScholarshipApplication (Phase 07/08). Appointment details, interview
notes, result date, and refusal reason are all left visible to STUDENT_PARENT.
**Reason**: The distinction this codebase's redaction axis has consistently drawn since
Phase 03 is "staff-internal information" vs. "a party's own record" (e.g. Contract value
IS visible to the owning Student/Parent, hidden from Consultant/Sales) — appointment date,
interview outcome, and refusal reason are literally about the affected student's OWN visa
process; hiding them would actively harm the student (they need to know their own
appointment time and, if refused, why) rather than protect anyone. `internalNotes` is the
one genuinely staff-only field (strategy/embassy-officer commentary), so it is the one
redacted. Passport/identity/financial EVIDENCE protection (the other groups the
instruction names) is handled by the existing Document grant system (`docs/ASSUMPTIONS.md`
ASM-23/ASM-24), not field-level redaction on Visa itself — Visa carries no raw passport-
number or financial-evidence text field at all, only FK references to Document rows.
**Affected modules**: `apps/api/src/modules/identity/rbac/field-policy.service.ts`
(`redactVisa`, `redactEnrollment`), `docs/security/RBAC_MATRIX.md` section 5.

## ASM-39 — Task/Notification triggers: `VISA_GRANTED` closes out Phase 06's last deferred Task trigger; three notification events chosen from the deferred candidate list

**Date**: 2026-08-19
**Context**: `06-operations/01_TASK.md` named "visa" as a Task auto-generation trigger
back in Phase 06, deferred then (`docs/ASSUMPTIONS.md` ASM-16) — the last of that file's
three originally-deferred triggers to be implemented (`application`/`scholarship` were
Phase 08). `06-operations/02_NOTIFICATION.md` separately named "visa appointment" as a
deferred notification event, alongside a generic candidate list this phase's own
orchestration prompt echoes: "Visa deadline, document missing, appointment, status change,
submission, result."
**Decision**: One new `TaskTemplateTrigger` value, `VISA_GRANTED`, fires once when a Visa
reaches GRANTED (never on REFUSED) — the significant-milestone moment, same scoping as
`CONTRACT_ACTIVATED`/`ROADMAP_APPROVED`/`APPLICATION_SUBMITTED`/`SCHOLARSHIP_AWARDED`.
Three notification events wired to every current CaseMember: `VISA_SUBMITTED` (the
"submission" candidate), `VISA_APPOINTMENT_SCHEDULED` (the literal deferred "visa
appointment" event), `VISA_RESULT` (the "result" candidate, fired for both GRANTED and
REFUSED with different payload). "Visa deadline" and "document missing" were NOT built —
no instruction file in 09-visa specifies a concrete deadline-reminder cadence (unlike
Task/Payment's explicit 30/14/7/3/1-day requirement), and "document missing" has no
concrete trigger definition anywhere; building either would be inventing an unrequested
mechanism, consistent with Phase 08's identical restraint (`docs/ASSUMPTIONS.md` ASM-30).
**Reason**: Each choice is either a literal named deferred item now due, or a direct
"significant milestone" analogue of an already-established pattern — never an invented
event.
**Affected modules**: `database/schema.prisma` (`TaskTemplateTrigger`), `apps/api/src/
modules/visa/visas/visas.service.ts`, `create-task-template.dto.ts`.

## ASM-40 — Partner "contacts" stays one primary contact person (name/email/phone), not a multi-contact sub-entity; no business-ID format for PartnerDocument/PartnerStudentLink/CommissionRule/CommissionTransaction

**Date**: 2026-08-19
**Context**: 10-partners/01_PARTNER_CRM.md lists "contacts" (plural) as a Partner field,
but `Partner` has carried a single `contactName`/`contactEmail` pair since the Phase 02
foundation slice, and no instruction text describes a multi-contact-person structure
(names, roles, multiple emails per partner). Separately, `00-context/00_MASTER_CONTEXT.md`'s
ID-format table defines `PT-CC-NNNNN` (Partner) and `PP-CC-NNNNN-NN` (PartnerProgram) but
is silent on PartnerDocument, PartnerStudentLink, CommissionRule, CommissionTransaction.
**Decision**: "Contacts" is read as one primary contact person, completed with a
`contactPhone` column added alongside the existing `contactName`/`contactEmail` (not a new
`PartnerContact` table). PartnerDocument/PartnerStudentLink/CommissionRule/
CommissionTransaction all get a plain UUID `id`, no business-code column.
**Reason**: Building a full multi-contact sub-entity from a single plural noun in a
one-line field list would be inventing structure the instruction never describes
("Không tự suy diễn requirement"); a single richer contact record is the minimal
completion of the existing Phase 02 shape. The no-business-ID decision continues the
established ASM-26/ASM-34 "sub-record/config entity absent from the ID table gets a plain
UUID" precedent — none of these four are top-level, master-context-reserved entities.
**Affected modules**: `database/schema.prisma` (`Partner.contactPhone`), the four new
Phase 10 models.

## ASM-41 — `PartnerProgram.programId` is an optional, one-directional FK to the Admission-domain `Program`; Program itself is not touched

**Date**: 2026-08-19
**Context**: `docs/architecture/DOMAIN_MAP.md` domain 8 explicitly flagged this as an open
gap since Phase 01B: "Program có thể liên kết `partner_program_id`" (REPOSITORY_AUDIT 5.6),
and the orchestration prompt frames it as a genuine either/or: link to the existing
University/Program master when a partner program corresponds to one, or keep it a fully
separate commercial mapping when it doesn't — "không tự merge nó với Program master nếu
requirement không yêu cầu."
**Decision**: `PartnerProgram` gets a nullable `programId` FK into the existing `Program`
model (Admission domain, Phase 08, already PASSed) — set when a partner's program
genuinely corresponds to a catalog Program row, left null when it's purely the partner's
own commercial/admission mapping (e.g. an agency package spanning multiple
universities/majors with no single catalog equivalent). `Program` itself gains only a
back-relation array (`partnerPrograms`); no column was added to `Program`, and Phase 08's
own service/controller code is untouched.
**Reason**: A one-directional, nullable, additive FK resolves the DOMAIN_MAP-flagged gap
without forcing every PartnerProgram to have a catalog equivalent (many won't) and without
touching Phase 08's already-PASSed `Program` model beyond a back-relation array — the
lowest-risk way to satisfy both instruction branches at once (`ARCH-DEC-03` already
established University/Program and Partner/PartnerProgram as genuinely separate entities;
this FK doesn't merge them, it just lets one reference the other like any two domain
entities do).
**Affected modules**: `database/schema.prisma` (`PartnerProgram.programId`, `Program.
partnerPrograms`), `apps/api/src/modules/partners/partner-programs/`.

## ASM-42 — PartnerDocument rebuilt on a real Document FK (replacing the unused Phase 02 `fileReference` string column); new `status`/`ownerId` columns for the immutable-once-signed lifecycle

**Date**: 2026-08-19
**Context**: `PartnerDocument` has existed since Phase 02 as schema-only (no
service/controller ever built against it — confirmed via code search, zero rows in the
table). Its Phase 02 shape stored `fileReference` directly as a string, the same "reference
before Document existed as a real subsystem" pattern Contract/Payment still carry
(`signedDocumentId`/`receiptDocumentId`, ASM-02). This phase's instruction is explicit:
"PartnerDocument phải sử dụng Document subsystem hiện tại... Không tạo storage/file
subsystem mới." It also required immutability once signed/final and a `status`/`owner`
field neither of which existed on the Phase 02 shape.
**Decision**: `fileReference` was replaced with a real `documentId` FK into `Document`
(same real-FK pattern as every Phase 07-09 evidence field, ASM-24) and `status`
(`PartnerDocumentStatus`: DRAFT/ACTIVE/EXPIRED/SUPERSEDED/ARCHIVED) and `ownerId` columns
were added. Confirmed zero existing rows before altering (same "safe to correct before any
service reads it" discipline as Phase 08's DEC-05 and Phase 09's `category` addition).
**Reason**: This is completing a schema that no service had ever built against, not
rewriting shipped work — the same "schema waited, this phase builds it" pattern already
applied to Documents (Phase 07) and Admission (Phase 08) at the module level, applied here
at the column level for one already-scaffolded table.
**Affected modules**: `database/schema.prisma` (`PartnerDocument`, new
`PartnerDocumentStatus` enum), `apps/api/src/modules/partners/partner-documents/`,
`apps/api/src/modules/documents/documents/documents.service.ts` (`grantRoleAccess`).

## ASM-43 — Phase 10 RBAC grant matrix and field-level redaction: Partner CRM/Commission is a business-development/finance function, deliberately zero-by-default for Consultant/Sales/Student-Parent

**Date**: 2026-08-19
**Context**: The orchestration prompt's security section is explicit and repeated:
"Finance/Admin phải có quyền commission/settlement phù hợp," "Sales/Marketing không mặc
định có quyền xem commission amount," "Consultant không mặc định được xem commission/
partner commercial terms," "Student/Parent không được xem commission," "Application/
Document Specialist chỉ xem partner documents theo scope," "User không có Partner scope
phải bị deny," "Internal partner notes phải được field-level protection nếu có." No
grant table is given.
**Decision**: Six resources (`partner`, `partner_programs`, `partner_documents`,
`partner_student_links`, `commission_rules`, `commission_transactions`), each
view/create/edit — "Không dùng một permission tổng PARTNER_* cho mọi hành động." ED/DM: full
on all six. ADMIN_FINANCE: full on `commission_rules`/`commission_transactions`
(settlement is its job, mirrors its Contract/Payment execution grant), view-only on the
other four (read context, not relationship management). DOCUMENT_SPECIALIST: view-only on
`partner` (enough context to make sense of a document) + `partner_documents` ("chỉ xem
partner documents theo scope," literally view-only), zero on the other four. CONSULTANT/
SALES_MARKETING/STUDENT_PARENT/SYSTEM_ADMIN: zero on all six. `Partner.internalNotes` is
field-level redacted (`FieldPolicyService.redactPartner`) from DOCUMENT_SPECIALIST — the
only granted role without full commercial visibility (ED/DM/ADMIN_FINANCE all see it in
full).
**Reason**: Every grant traces directly to one of the literal instruction sentences above;
zero-by-default for CONSULTANT/SALES_MARKETING/STUDENT_PARENT is the conservative reading
of "không mặc định" repeated three separate times for three separate roles, consistent
with the same conservative-when-ambiguous treatment ADMIN_FINANCE received on Phase 07/08
counseling/admission resources and SALES_MARKETING received on Phase 07/08/09
Student/Case-scoped data. Access is deliberately GLOBAL/permission-gated rather than tied
to Case membership (no new `ScopeKind`) — the only two roles ever granted anything on the
three most sensitive resources (ED/DM/ADMIN_FINANCE) already carry `ScopeKind.GLOBAL`
everywhere else in the system, so a Case-membership-based scope dimension would add
complexity with no role it could actually narrow.
**Affected modules**: `database/seeds/seed.ts`, `docs/security/RBAC_MATRIX.md`,
`apps/api/src/modules/identity/rbac/field-policy.service.ts` (`redactPartner`).

## ASM-44 — CommissionRule basis/precedence design; no automatic Payment-triggered CommissionTransaction generation

**Date**: 2026-08-19
**Context**: 10-partners/01_PARTNER_CRM.md's field list names "basis, rate, conditions,
effective date" without defining exactly which bases exist or how a matching rule is
selected when several could apply; the orchestration prompt gives examples ("contract
value, collected payment, university-paid commission, other basis") and explicitly
requires "Nếu có nhiều rule có thể cùng match: phải có deterministic precedence/selection
rule... nếu chưa quy định rõ, ghi assumption." Separately, `docs/architecture/DOMAIN_MAP.md`
domain 7 (Commercial) names a `CommissionTriggerEvent` expose point ("phát sự kiện cho
partners khi payment đủ điều kiện tính hoa hồng") that was never built in any prior phase.
**Decision**: `CommissionBasis` is CONTRACT_VALUE, PAYMENT_COLLECTED, or FIXED — the only
two bases with a concrete, already-existing source of truth to read from
(`Contract.value`/`Payment.paidAmount`) plus a source-less flat-amount option;
"university-paid commission" and other abstractly-named bases with no concrete
field/entity/trigger anywhere in the instruction text were not built. Precedence: a
CommissionRule scoped to a specific PartnerProgram outranks a partner-wide one, then higher
`priority` wins, then most-recently-created, then `id` as a final deterministic tie-break —
never random. CommissionTransaction creation is a manual, explicit staff/finance action
(`POST /partners/:id/commission-transactions`, naming the triggering Contract/Payment by
id) — no automatic Payment-status-driven event wiring into `PaymentsService` was built.
**Reason**: The precedence rule follows directly from ordinary "more specific wins" logic,
documented rather than left to chance, per the instruction's own explicit requirement. The
manual-creation choice avoids touching Phase 05's already-PASSed `PaymentsService` with a
new event-emission concern non-trivially, and 10-partners/01_PARTNER_CRM.md itself never
states a concrete automatic trigger condition (unlike Phase 08/09's named Task/Notification
triggers) — inventing one would risk exactly the "silently invent business rules" the
project's Hard Rules forbid. `calculate()` always reads the live Contract/Payment source at
calculation time regardless of how the transaction was created, so the actual amount is
never stale even without automatic triggering.
**Affected modules**: `database/schema.prisma` (`CommissionBasis`), `apps/api/src/modules/
partners/commission-rules/commission-rules.service.ts` (`selectRuleFor`), `apps/api/src/
modules/partners/commission-transactions/commission-transactions.service.ts`.

## ASM-45 — No adjustment/reversal mechanism for PAID/CANCELLED CommissionTransaction rows

**Date**: 2026-08-19
**Context**: "Nếu transaction đã finalized/paid: không sửa trực tiếp. Dùng
adjustment/reversal mechanism nếu SRS yêu cầu. Nếu adjustment chưa nằm trong SRS, không tự
tạo phức tạp ngoài scope; ghi assumption/risk." 10-partners/01_PARTNER_CRM.md itself never
names an adjustment or reversal concept anywhere.
**Decision**: PAID and CANCELLED are both hard-terminal — `updateLinkage`/every FSM action
rejects any further mutation once either is reached (`409
COMMISSION_TRANSACTION_NOT_EDITABLE`/`COMMISSION_TRANSACTION_CLOSED`). No adjustment,
reversal, credit-note, or "PAID → re-open" mechanism was built.
**Reason**: The instruction is explicit that building one is out of scope unless the SRS
requires it, and it doesn't — the correct response is exactly what it says: implement the
"no direct edit" half, and record the gap as an assumption/risk rather than inventing a
reversal workflow ("không tự tạo phức tạp ngoài scope"). A future phase correcting a
mis-paid commission would need to either add a real adjustment entity or (for a
CANCELLED-before-PAID case) simply create a fresh, correct CommissionTransaction against
the same source — the duplicate-check keys on `(sourceType, sourceId, ruleId)` excluding
CANCELLED rows specifically so a corrected re-attempt after a cancellation is never blocked.
**Affected modules**: `apps/api/src/modules/partners/commission-transactions/
commission-transactions.service.ts`.

## ASM-46 — Parent relationship lifecycle: no new ParentStudentLink entity; token-possession invitation; revocation closes both scope AND existing Document grants

**Date**: 2026-08-20
**Context**: 11-portal/01_STUDENT_PARENT_PORTAL.md requires a full parent access lifecycle
— invite, verification, relationship creation, access, and revoke, with revocation taking
effect immediately — while simultaneously forbidding any new parallel entity duplicating
what already exists. `StudentContact` has occupied exactly the "linked parent" role since
Phase 03 (`portalUserId`), but had no lifecycle state beyond a bare nullable FK; separately,
`docs/ASSUMPTIONS.md` ASM-05 never specified what "verification" means for a parent invite,
and no existing mechanism modeled "one Parent User, several children" (the Phase 03
`portalUserId` was `@unique`, permanently ruling that out).
**Decision**: Extend `StudentContact` in place with `portalStatus` (`PortalLinkStatus`:
NONE/INVITED/ACTIVE/REVOKED), `revokedAt`, `revokedById` — no new
`ParentStudentLink`/`ParentApplication` entity. A new `ParentInvitation` table (one row per
invite *attempt*, hash-only token, expiry, single-use `acceptedAt`) mirrors
`password_reset_tokens`/`ContractReviewLink.tokenHash` exactly — "verification" is token
possession, the same standard already established for password reset, not a new concept.
`StudentContact.portalUserId`'s Phase 03 `@unique` constraint is relaxed to a plain index
(`docs/DECISIONS.md` DEC-06) so one Parent `User` can link to multiple children.
Acceptance (`PortalAccessService.acceptInvitation`) reuses an existing `User` by email match
when one already holds the STUDENT_PARENT role (never duplicates a User for a multi-child
parent), else creates a new one. Revocation is a two-part operation, since this codebase has
two independent access mechanisms: (1) every `ScopePolicyService` OWN_STUDENT-aware method
now additionally requires `portalStatus = 'ACTIVE'`, read live on every request, and (2)
`PortalAccessService.revokeParentAccess` additionally expires all of the revoked user's
non-expired `DocumentAccess` grants in the same transaction — the first change alone would
have left previously-granted document downloads reachable after revocation, a gap discovered
by tracing the full access-check surface rather than assumed away.
**Reason**: "Quyền truy cập phải mất ngay theo policy" (revocation must take effect
immediately) is only true if every path that could still authorize access after revocation
is found and closed — a single boolean/status flip on `StudentContact` alone would not have
covered `DocumentAccess`'s independent grant table. Reusing `StudentContact`/
`password_reset_tokens`' existing shape rather than inventing new verification/relationship
concepts follows the phase's own explicit "không tạo duplicate entity" instruction.
**Affected modules**: `database/schema.prisma` (`StudentContact`, `PortalLinkStatus`,
`ParentInvitation`), `apps/api/src/modules/identity/rbac/scope-policy.service.ts` (7
methods), `apps/api/src/modules/portal/portal-access/portal-access.service.ts`,
`docs/DECISIONS.md` DEC-06.

## ASM-47 — `portal:access` as a single class-level permission gate, not a per-capability breakdown

**Date**: 2026-08-20
**Context**: `AuthGuard` allows any authenticated principal through a route that declares no
`@RequirePermission` at all (the same mechanism `NotificationsController`'s self-service
inbox relies on). `PortalController` exposes ~20 routes across ~10 existing domains; the
phase instruction requires "Kiểm tra role: chỉ Student/Parent" while also requiring that
Portal duplicate no existing domain's permission/authorization logic.
**Decision**: One new permission resource, `portal`, one action, `access`, applied at the
CLASS level on `PortalController`, granted only to STUDENT_PARENT. This is a gate deciding
*whether the caller may enter the Portal layer at all*, not the authorization itself — the
real per-record decision remains each reused domain service's own existing scope check
(`ScopePolicyService`, revocation-aware per ASM-46) and field redaction, applied exactly as
it already is for staff callers. No per-Portal-capability resource
(`portal_tasks`/`portal_documents`/...) was created.
**Reason**: Without this gate, any authenticated staff role would also reach
`/portal/students/:id/*` (harmless in practice, since the record-scope check underneath
would still apply their own legitimate scope — a CONSULTANT hitting a Portal route would
just get whatever their normal Case-membership scope already allows) but is still an
unintended, unaudited-as-such access path a defense-in-depth review would flag; "ensure
staff roles không bị ảnh hưởng" calls for an explicit, visible deny rather than an
accidental allow that merely happens to be harmless today. A single gate (not
per-capability) keeps the change minimal and matches how `PortalService` itself works —
one thin delegation layer, not ten independently-secured sub-features.
**Affected modules**: `apps/api/src/modules/portal/portal/portal.controller.ts`,
`database/seeds/seed.ts` (`PERMISSIONS`/`GRANTS`), `docs/security/RBAC_MATRIX.md` section 2.

## ASM-48 — Narrow, additive "submit evidence"/task-portal methods instead of reusing broad generic `update()`; `Task.visibleToStudent` opt-in; unconditional `redactTaskForPortal`

**Date**: 2026-08-20
**Context**: `MilestonesService`/`ApplicationChecklistService`'s existing generic `update()`
methods accept a broad field set (status, objective, ownerId, ...) intended for staff
callers; letting a student reach either directly would let them change fields Section 4/6/7
of the phase instruction explicitly forbid self-service on. Separately, Task Engine
(`TasksService.assertTaskAccessible`) was built Phase 06 as staff-only tooling and
explicitly 404s every OWN_STUDENT caller — the phase instruction requires students see
*explicitly shared* tasks only, never "all internal staff tasks."
**Decision**: New, narrow, single-purpose methods only where the existing method was
genuinely unsuitable for student self-service: `MilestonesService.submitEvidence(caseId,
milestoneId, documentId)` and `ApplicationChecklistService.submitEvidence(caseId,
checklistItemId, documentId)` each write exactly one FK field and nothing else. Task gets
one new column, `visibleToStudent` (default `false` — every existing and new task stays
staff-only unless explicitly opted in), and four new `TasksService` methods
(`listForStudentPortal`/`getForStudentPortal`/`portalSubmitOutput`/`portalUpdateStatus`)
that filter on it directly, bypassing `assertTaskAccessible` entirely rather than trying to
carve an OWN_STUDENT exception into staff-only logic. `portalUpdateStatus` reuses the exact
same FSM/precondition logic as the staff path via an extracted private
`applyStatusTransition`, reached through a different authorization entry point — never a
second, drifted copy of the transition rules. `FieldPolicyService.redactTaskForPortal` is
deliberately unconditional (not role-varying like every other `redact*` method) since it
only ever runs on this one student-facing path.
**Reason**: "Không cho học sinh tự sửa các trường ownership/case internal-status/..." is
best satisfied by never exposing the broad method at all, rather than field-allowlisting at
the DTO layer on top of a method whose service-layer body still trusts a wider input shape.
Reusing the FSM logic (not duplicating it) keeps the single source of truth for what
transitions are legal, per the phase's own "no duplicated business logic" rule.
**Affected modules**: `apps/api/src/modules/counseling/roadmaps/milestones.service.ts`,
`apps/api/src/modules/admission/applications/application-checklist.service.ts`,
`apps/api/src/modules/case-management/tasks/tasks.service.ts`, `database/schema.prisma`
(`Task.visibleToStudent`), `apps/api/src/modules/identity/rbac/field-policy.service.ts`
(`redactTaskForPortal`).

## ASM-49 — Portal capability boundaries: read-only profile, no new Comment/messaging entity, latest-case-only for list/mutation with an explicit studentId cross-check on every detail view

**Date**: 2026-08-20
**Context**: Three separate scope questions the phase instruction leaves for this phase to
resolve concretely: (1) whether Student/Parent get any profile self-edit capability beyond
what section 4's explicit prohibition list leaves untouched — nothing does, once every
forbidden field is excluded; (2) whether a Comment/messaging capability should be built —
section 15 only conditionally names it ("nếu MD cho phép... interact"), with no concrete
requirement anywhere in the phase's own instruction file; (3) which Case a Student's
list/mutation Portal actions (roadmap, tasks, applications by default, etc.) should resolve
against, given a Student can have multiple Cases over time (SRS allows case history), and a
Parent can be linked to multiple Students (ASM-46) whose Case a URL's `studentId` alone
doesn't disambiguate for detail-view records.
**Decision**: (1) No `PATCH /portal/students/:id` (or any profile-mutation) route exists —
Portal's profile surface is 100% read-only, `PortalService.getProfile` only. (2) No new
`PortalMessage`/`StudentMessage`/`ParentComment` entity or endpoint was built; the existing
`Comment` entity's student-visibility split (Phase 04, `docs/security/RBAC_MATRIX.md`
section 5 "Internal notes" row) was left exactly as-is. (3) `PortalService.resolveCase`
resolves to the Student's most-recently-opened Case (`orderBy: {openedAt: 'desc'}`) for
list/mutation actions; every detail-view method (`getApplication`/`getVisa`/
`getScholarship`/etc.) additionally asserts `record.studentId === studentId` rather than
restricting to the latest case only, so multi-case history remains reachable by record id
while still rejecting a multi-child Parent viewing child B's record under a URL naming
child A.
**Reason**: (1)/(2) are each a "the instruction doesn't concretely require this, and
building it would risk inventing a business rule the phase's own Hard Rules forbid"
situation — see the analogous reasoning in ASM-45 (Commission adjustment) for the same
class of judgment call. (3) is a genuine design gap the phase instruction doesn't name
directly: a pure "latest case only" rule for detail views would silently 404 legitimate
access to a record under an older, still-real Case; a pure "look up the record's own
studentId with no case restriction" rule for list/create actions would have no sensible
single Case to act against. Splitting the two (latest-case for list/mutation-without-an-
explicit-record, direct studentId ownership check for anything with a concrete record) is
the reading that keeps both correct.
**Affected modules**: `apps/api/src/modules/portal/portal/portal.service.ts`.

## ASM-50 — Document storage/security design: local-disk default StorageProvider, EICAR-only default scanner, principal-scoped signed download tokens, informational duplicate detection, no automatic retention deletion

**Date**: 2026-08-20
**Context**: 12-platform/01_DOCUMENTS.md requires "private object storage," "signed URL,
short expiry, authorization before URL generation," "malware scan," and "checksum" — but
this project has no cloud storage credentials, no antivirus engine/API license, and no
concrete retention policy per document type was ever specified anywhere in Phase 01-12's
instruction files.
**Decision**: (1) `StorageProvider` is a real interface; the default bound implementation
(`LocalFilesystemStorageProvider`) writes to a private, non-web-served directory on local
disk (`DOCUMENT_STORAGE_DIR`), using a provider-generated random UUID as the storage key —
never derived from the client's filename, which structurally rules out path traversal (no
user input ever reaches a filesystem path). (2) `MalwareScanProvider`'s default
(`HeuristicMalwareScanProvider`) detects only the industry-standard EICAR test signature —
not a real signature-database scan — but the async PENDING→CLEAN/INFECTED state machine
and the "no download before the required security stage passes" gate are real, enforced,
and independently testable (checked at both the authorize-and-issue-signed-URL step and
again at the byte-serving step). (3) Download is a two-step signed-URL flow: `SignedUrlService`
issues a stateless HMAC-SHA256 token scoped to exactly one `documentId` + one `principalId`,
short TTL (`DOCUMENT_DOWNLOAD_URL_TTL_SECONDS`, default 60s) — "không reuse vô hạn" is
satisfied by the short TTL (the same property a real cloud presigned URL has), not a
server-side single-use-consumption ledger, which would add state for a property time-limiting
already delivers. (4) Duplicate detection (same checksum, same owner) is informational only
(`duplicateOfId` returned, upload never blocked) — no MD names a blocking rule, and
inventing one risks the "silently invent business rules" the project's Hard Rules forbid.
(5) `retentionUntil`/`legalHold` (Phase 02 columns) are tracked but no automatic deletion
job was built — Hard Rule #5 (no hard-delete anywhere in this system) and the phase's own
explicit "Không tự động delete legal/audit-required documents" both point the same
direction; retention stays a reporting/policy-tracking concern only, not an active purge.
**Reason**: Each of these five is the same class of judgment call as prior phases'
"instruction names a requirement in principle but leaves the concrete mechanism
unspecified, or this environment has no real credentials for it" situations (e.g. ASM-18's
original email-provider gap) — build the real, enforced architecture and state boundary
honestly rather than fake a capability this environment cannot actually back.
**Affected modules**: `apps/api/src/common/storage/*`, `apps/api/src/modules/documents/
documents/documents.service.ts`, `documents.controller.ts`, `documents.module.ts`.

## ASM-51 — External-data-sync scope: only University gets a real sync method, matched by externalId only, never inserts

**Date**: 2026-08-20
**Context**: 12-platform/02_INTEGRATIONS_JOBS.md requires external-data-sync fields
(source/URL/retrieved_at/last_verified_at/sync status/external ID) and "không silently
overwrite manually verified data," paired with an `ExternalSchoolDataProvider` adapter
(02_INTEGRATIONS_JOBS.md "adapters: external school data"). No concrete external
university/program/scholarship data source or credentials exist in this environment.
**Decision**: `sourceUrl`/`externalId`/`retrievedAt`/`syncStatus` columns were added to all
three Admission master-data tables (University, Program, ScholarshipMaster) for schema
consistency, but only `UniversitiesService.syncExternal` was built. It matches incoming
records by `externalId` ONLY (never by name) and only ever UPDATES an existing row with a
matching `externalId` — a sync record with no matching row is skipped, never inserted, so
"Không duplicate University" holds even under sync. A row already verified by staff more
recently than the last sync (`lastVerifiedAt > retrievedAt`) is skipped and flagged
`MANUAL_OVERRIDE` rather than overwritten. The default `ExternalSchoolDataProvider`
(`NoopExternalSchoolDataProvider`) returns no records, so in practice this sync job is a
no-op today — but the conflict-avoidance logic itself is real and independently tested (a
fake provider is substituted in the test suite).
**Reason**: Building Program/ScholarshipMaster sync methods with no concrete data source to
sync from would be speculative, untestable-against-anything-real code; the schema columns
exist so a future phase adding a real provider for either doesn't need a migration. Never
inserting new rows from sync (only updating externalId-matched ones) is the conservative
reading of "Không silently overwrite" extended to its logical counterpart — "không silently
create," since an unreviewed sync-created University row would be exactly as risky as an
overwritten one.
**Affected modules**: `database/schema.prisma` (University/Program/ScholarshipMaster),
`apps/api/src/modules/admission/master-data/universities.service.ts`,
`master-data.module.ts`, `apps/api/src/common/integrations/
external-school-data-provider.interface.ts`.

## ASM-52 — Job queue: Postgres-backed `BackgroundJob` table + in-process poller, not Redis/BullMQ (revises Phase 06 ASM-18)

**Date**: 2026-08-20
**Context**: Phase 06's own ASM-18 note, written when Task/Payment reminder sweeps were
built as manually-triggerable endpoints, said "no scheduler/queue infra exists in this repo
yet (Redis/BullMQ is 12-platform scope)" — naming a specific technology as the anticipated
Phase 12 solution. 12-platform/02_INTEGRATIONS_JOBS.md itself never names Redis/BullMQ
specifically; it asks for "queue/worker architecture" with job type/payload schema/
idempotency/retry/failure-state/logging/correlation-id properties.
**Decision**: A new `BackgroundJob` Postgres table (`JobsService` for idempotent enqueue via
a unique `dedupeKey`, `JobRunnerService` for an in-process `setInterval` poller that claims
a batch atomically, dispatches to a per-`jobType` registered handler, and retries
`TransientJobError`s with exponential backoff) — no Redis, no BullMQ, no new docker-compose
service.
**Reason**: This environment has no Redis instance and no message-broker infra of any kind;
adding one is a nontrivial new operational dependency (a new container, a new failure mode,
new deployment complexity) that the MD's own text doesn't concretely require — only ASM-18's
own prior note named the specific technology, and that note is revisable (unlike a
DECISIONS.md-grade conflict between two authoritative instructions). A DB-backed queue
delivers every property the MD's text actually asks for (idempotency via a unique
constraint, retry with backoff, failure state, structured logs, correlation IDs) and is
fully synchronous-testable in e2e (`processPendingJobs()`/`tick()` are public, directly
callable methods — the same "manually invokable, not only wall-clock-driven" testability
precedent Phase 06's reminder sweeps already established), at a scale (this project's
current data volume) that doesn't need true distributed-queue throughput. `NODE_ENV=test`
disables the automatic poller/scheduler ticks specifically to avoid a real wall-clock timer
racing against a test's own explicit drain calls — production/dev behavior (auto-start) is
unaffected.
**Affected modules**: `database/schema.prisma` (`BackgroundJob`), `apps/api/src/common/
jobs/*`, `apps/api/src/common/scheduler/*`.

## ASM-53 — Webhook scope: one concrete, side-effect-free esign receiver; generic infrastructure for future sources

**Date**: 2026-08-20
**Context**: 12-platform/02_INTEGRATIONS_JOBS.md's Webhooks section requires signature
verification, idempotency, event ID storage, retry, and audit — without naming a concrete
external system anywhere in Phase 01-12's instruction files. The adapter list in the same
file names "e-signature" as one of the providers to build adapter architecture for.
**Decision**: One concrete endpoint, `POST /webhooks/esign`, paired with the `ESignProvider`
adapter interface (the one named adapter with a plausible concrete webhook counterpart).
Generic, reusable infrastructure backs it (`IncomingWebhookEvent` table, `(source, eventId)`
uniqueness as the idempotency/replay-protection mechanism, `verifyWebhookSignature` HMAC
utility) so a future phase adding a different concrete webhook source reuses the same
pattern. The handler is deliberately side-effect-free on business data — it verifies,
records, and audits the event only; it never auto-mutates `Contract.status` or any other
entity. No other webhook endpoint was built.
**Reason**: Building a full endpoint for a vendor with no concrete integration point named
anywhere would be inventing a feature; building none at all would leave the MD's literal
"Webhooks: ..." requirement completely unaddressed. One minimal, safe, real example — tied
to the one adapter the same file names — demonstrates the full required property set
(signature verification, idempotency, event storage, audit) without inventing unauthorized
business behavior. Not auto-mutating Contract from an unreviewed external event specifically
avoids creating a NEW business rule (an external actor completing a contract-sign workflow)
that Phase 05's own `Contract.sign()` design (staff-recorded, requiring a `signedDocumentId`)
never anticipated.
**Affected modules**: `database/schema.prisma` (`IncomingWebhookEvent`), `apps/api/src/
common/webhooks/*`, `apps/api/src/modules/documents/webhooks/*`.

## ASM-54 — Adapter architecture: EmailProvider and ExternalSchoolDataProvider get real call sites; ESign/Calendar/Accounting/SMS are interface + stub only

**Date**: 2026-08-20
**Context**: 12-platform/02_INTEGRATIONS_JOBS.md names six adapters to build: email,
e-signature, calendar, payment/accounting, SMS/Zalo/WhatsApp, external school data. "Domain
phải gọi adapter/interface, không hard-code provider-specific logic" requires the
architecture to exist; it does not require every adapter to have a concrete business
feature calling it today.
**Decision**: Every one of the six gets a real TS interface + a DI-registered default
implementation (`IntegrationsModule`). Only two have an actual call site wired into
existing business logic: `EmailProvider` (`NotificationsService`'s EMAIL channel now
enqueues a real dispatch job instead of leaving `sentAt` permanently null — closing the gap
ASM-18 originally left open) and `ExternalSchoolDataProvider` (the `EXTERNAL_DATA_SYNC` job,
ASM-51). `ESignProvider`/`CalendarProvider`/`AccountingProvider`/`SmsProvider` have no'
domain code invoking them — no Phase 01-12 instruction names a concrete workflow requiring
e-signature envelope creation, calendar event creation, external accounting entries, or an
SMS notification channel.
**Reason**: Same "adapter readiness vs. inventing a feature" boundary as ASM-53 — the
architecture (interface, DI binding, swappability) is what the MD's own text concretely
asks for; a call site with no named business requirement behind it would be invented
functionality. Email and ExternalSchoolData are the two adapters where a genuine,
already-existing gap (ASM-18's unfinished email dispatch; the external-sync columns Phase
08 already added) gave a concrete, real place to wire one in.
**Affected modules**: `apps/api/src/common/integrations/*`, `apps/api/src/modules/
notifications/notifications/notifications.service.ts`, `notifications.module.ts`.

## ASM-55 — Reporting scope: SLA/quality as honestly-labeled derived metrics (not an invented score); Student/Parent reporting is Portal, unchanged; export limited to Cases

**Date**: 2026-08-20
**Context**: 12-platform/03_REPORTING.md names "SLA," "quality," and "bottleneck" as
Manager-report metrics without defining any of the three concretely anywhere in the SRS or
any prior phase. It also names a Student section (roadmap/deadlines/application/documents)
that is textually identical to what Phase 11's Portal already built, and a generic
"Exports: permission-controlled, scoped, audited" requirement without naming which
entities must be exportable.
**Decision**: (1) "SLA"/"quality" are computed as two clearly-labeled, honestly-named
derived metrics — `onTimeCompletionRate` (DONE tasks completed at/before deadline ÷ total
DONE tasks, using `Task.updatedAt` as an honest proxy for completion time since no
dedicated `completedAt` column exists) and `averageQualityScore` (mean of `Task.qualityScore`,
completing DATA_DICTIONARY.md section 4.7's own "feeds KPI... computed *from* here in a
later phase" note) — never an invented, unlabeled composite "SLA score." (2) No new
Student/Parent reporting endpoint was built — `/portal/students/:id/{roadmap,tasks,
applications,scholarships,visa,documents,...}` (Phase 11) already satisfies every field
this section names, with the exact same field-redaction Reporting reuses everywhere else;
`ReportsController` grants STUDENT_PARENT zero `reports` permission. (3) Export was built
concretely for one entity, Cases (`GET /reports/cases/export`, ED/DM-only, reason-required,
scope-filtered via the same `ScopePolicyService.caseListFilter` every Case list endpoint
already uses, audited per SRS 6.21) rather than inventing a generic per-entity export
system — the dashboard endpoints (`/reports/executive`/`/manager`/`/me`) are themselves the
primary "report" surface the MD's Executive/Manager/Staff sections concretely ask for.
**Reason**: Defining "SLA" or "quality" as a single unexplained number would be inventing a
business rule (what counts as meeting an SLA was never specified); a transparent, named
formula lets a future phase redefine or extend it without ambiguity about what the current
number even means. Building a second Student/Parent reporting surface would duplicate
Portal's already-PASSed field-redaction and access logic — exactly the kind of duplication
the project's Hard Rules forbid. Scoping export to one concrete, clearly valuable target
(Cases) rather than a speculative universal exporter keeps the deliverable real and testable
without overreaching past what "Exports: permission-controlled, scoped, audited" concretely
requires.
**Affected modules**: `apps/api/src/modules/reporting/reports/*`.

## ASM-56 — General API rate-limiting (beyond login lockout) — deferred in Phase 13, implemented in Phase 14

**Date**: 2026-08-20 (Phase 13), updated 2026-08-20 (Phase 14)
**Context**: Phase 13's security audit (13-qa/02_SECURITY_REVIEW.md "brute force") found
that NFR-SEC-01/NFR-SEC-06's "Rate limit login/API; chống brute force" is only half-built:
`POST /auth/login` has real account lockout after a configurable failed-attempt threshold
(03-security/01_AUTH.md, Phase 03), but no general-purpose rate limiter exists for any
other endpoint.
**Phase 13 decision**: Not implemented under time pressure alongside a large QA audit —
documented as a known gap rather than rushed.
**Phase 14 decision**: Implemented. `@nestjs/throttler` (`common/rate-limit/rate-limit.
module.ts`) provides a global default limit (env-configurable, `RATE_LIMIT_WINDOW_MS`/
`RATE_LIMIT_MAX_REQUESTS`, default 120 req/60s per IP), applied as an `APP_GUARD` alongside
the existing `AuthGuard`. `POST /auth/login` additionally carries its own tighter
`@Throttle({ limit: 10, ttl: 60_000 })` override on top of the existing per-account
lockout — brute-forcing is now bounded both per-account (lockout) and per-IP (this).
`skipIf: NODE_ENV==='test'` mirrors the identical, already-vetted pattern `JobsModule`/
`SchedulerModule` use (Phase 12) — confirmed via a full regression run (163 unit + 460 e2e,
unchanged pass count) that this introduced zero test flakiness.
**Reason the Phase 13 deferral was correct at the time, and Phase 14 is the right phase to
close it**: adding a global rate limiter mid-audit alongside dozens of other fixes was
real, avoidable risk; Phase 14's explicit mandate (production hardening) is exactly the
reviewed, dedicated pass this deserved. In-memory throttler storage (the package default)
is single-instance-scoped — a multi-instance deployment needs a shared store (e.g.
Redis-backed `ThrottlerStorage`) for limits to hold across instances; see
`docs/production/SECURITY_BASELINE.md`.
**Affected modules**: `apps/api/src/common/rate-limit/rate-limit.module.ts`,
`apps/api/src/modules/identity/auth/auth.controller.ts`, `apps/api/src/app.module.ts`.

## ASM-57 — Concurrent-request (TOCTOU) races on check-then-create uniqueness invariants

**Date**: 2026-08-20 (Phase 13), extended 2026-08-20 (Phase 14)
**Context**: `CasesService.createForStudent` and `LeadsService.convert` both enforce "at
most one non-CLOSED/ARCHIVED Case per Student" via a check-then-create pattern
(`findFirst` then `create`), not a database constraint. Two concurrent requests could both
pass the check before either write lands, producing two simultaneous active Cases for one
Student. Phase 14's Final Architect Review found the identical pattern in one more place:
`ApplicationsService.assertNoActiveDuplicate` (same findFirst-then-create shape, same
narrow race window, guarding "at most one active Application per Student+Program+intake").
**Decision**: Not fixed in Phase 13 or 14. Documented as a known, narrow data-integrity gap
— generalized to cover both instances found so far, since the reasoning and fix shape are
identical.
**Reason**: The durable fix is a partial unique index (e.g. `CREATE UNIQUE INDEX ... ON
cases(student_id) WHERE status NOT IN ('CLOSED','ARCHIVED')`), which is not expressible in
`schema.prisma`'s declarative syntax (would need to be hand-maintained as a raw-SQL-only
migration artifact, invisible to `prisma migrate diff`/future drift detection) and is hard
to exercise deterministically in the existing e2e suite (requires genuine concurrent
requests, not just sequential ones). The realistic exploitation window (two staff members
racing to create the same record within milliseconds of each other) is narrow enough that
a rushed fix risked more than the gap itself. If a third instance of this pattern is found
in a future phase, that's the signal to build a shared, tested helper/convention for it
rather than deferring a third time.
**Affected modules**: `apps/api/src/modules/case-management/cases/cases.service.ts`,
`apps/api/src/modules/crm/leads/leads.service.ts`,
`apps/api/src/modules/admission/applications/applications.service.ts`.

## ASM-58 — Document checksum re-verification deferred to a future phase

**Date**: 2026-08-20
**Context**: `Document.checksumSha256` is computed and stored at upload/version-create time
(Phase 12) but never re-verified when a document is actually downloaded — so if the
storage layer's bytes were altered after upload (disk corruption, a future non-immutable
storage provider, an out-of-band admin action), the tampered bytes would be served with no
detection.
**Decision**: Not implemented in Phase 13.
**Reason**: With the current `LocalFilesystemStorageProvider`, whose only write path is the
upload/version-create flow itself, this is a defense-in-depth gap rather than a live
vulnerability — there is no code path today that mutates stored bytes out-of-band. Adding
re-hash-on-every-download is a real, bounded feature (a genuine I/O cost on every
download), better scoped and reviewed on its own than bolted onto an already-large audit
phase.
**Affected modules**: `apps/api/src/modules/documents/documents/documents.service.ts`.

## ASM-59 — LOR (Letter of Recommendation) field-redaction confirmed correct; e2e assertion is a tracked test-gap

**Date**: 2026-08-20
**Context**: Phase 13's traceability audit confirmed by static code read that
`FieldPolicyService.redactLor` is wired at all 4 of `lor.controller.ts`'s read sites,
correctly stripping `internalNotes`/`contactEmail`/`contactPhone` from STUDENT_PARENT
responses — but found no dedicated e2e assertion proving this behavior (unlike the
equivalent redaction tests that exist for Visa/Enrollment/Partner).
**Decision**: Not treated as a code defect (the implementation is correct); tracked as a
test-coverage gap for a future phase to close with a single assertion mirroring the
existing `visa.e2e-spec.ts` "redacts internalNotes from STUDENT_PARENT" pattern.
**Reason**: Phase 13's fix budget prioritized CRITICAL/HIGH defects with live security
impact; a confirmed-correct code path missing only its own regression test is LOW severity
and does not block the release gate.
**Affected modules**: `apps/api/test/writing.e2e-spec.ts` (or a new `lor.e2e-spec.ts`).

## ASM-60 — Disaster recovery RPO/RTO are assumed targets, not a business-confirmed SLA

**Date**: 2026-08-20
**Context**: 14-production/01_PRODUCTION_HARDENING.md requires a documented disaster
recovery plan with RPO/RTO; no prior phase or SRS section names either figure concretely
(SRS NFR-SEC-07 only says "Backup encrypted; test restore định kỳ" — practice, not a
number).
**Decision**: Documented assumed targets — RPO ≤ 24 hours (daily backup cadence), RTO ≤ 4
hours (based on this phase's actual timed restore drill, which completed in under 5
minutes against current data volume) — explicitly labeled as an assumption in
`docs/production/DISASTER_RECOVERY.md`, not asserted as an official SLA.
**Reason**: Per this phase's own instruction ("Nếu RPO/RTO chưa được business xác định: ghi
assumption thay vì tự tuyên bố SLA chính thức"), declaring an unconfirmed number as an
official commitment would misrepresent what's actually been agreed; a clearly-labeled
assumption gives ops a concrete, reasoned starting point business can confirm or override.
**Affected modules**: `docs/production/DISASTER_RECOVERY.md`.

## ASM-61 — No off-host backup storage or scheduled backup job provisioned in this environment

**Date**: 2026-08-20
**Context**: A real backup strategy needs an off-host storage target (survives the primary
database host failing) and a scheduled job to run it. This development environment has no
cloud storage credentials (the same constraint already documented for Document object
storage — ASM-50) and no scheduler infrastructure beyond the application's own in-process
job poller (which itself depends on the database being up, making it unsuitable for
backing up that same database).
**Decision**: The backup/restore *procedure* was built and verified for real in this phase
(see `docs/production/DISASTER_RECOVERY.md`'s drill), but the *automation* (a cron/managed-
service job that runs `pg_dump` on a schedule and ships the result off-host) was not
provisioned — there's no environment to provision it into.
**Reason**: Fabricating a backup schedule against infrastructure that doesn't exist would
be undemonstrated, untestable configuration, not a real hardening improvement. This is
explicitly named as a **production blocker** — see `docs/phase-status/PHASE_14.md`'s
release-readiness classification — not silently treated as already handled.
**Affected modules**: none in this repository; a real deployment's infrastructure/ops
tooling.
