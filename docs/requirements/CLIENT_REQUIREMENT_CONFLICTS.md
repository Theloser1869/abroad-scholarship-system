# Client Requirement Conflicts

Companion to `docs/requirements/CLIENT_ACCEPTANCE_MATRIX.md` and the Client Acceptance
Remediation (Blocker Fix Phase). These are the 3 formal CONFLICT items first identified in
the original Client Acceptance Audit — genuine divergences between the customer Excel
(`docs/He_thong_quan_ly_du_hoc_hoc_bong.xlsx`) and the implementation that were **not**
silently resolved by assumption during remediation, per this phase's own explicit
instruction. Two remain fully open (no code changed for them in this phase); one
(CONFLICT-001) received a real, working fix for its concrete functional consequence
(GAP-002) while the underlying modeling/threshold question itself is still open and
requires client sign-off.

Do not treat any "Suggested resolution" below as already applied — each is a proposal
pending client confirmation.

---

## CONFLICT-001 — Contract status sequence (11 stages vs. 9 implemented; PAYMENT/AMENDED not modeled as statuses) — payment-received gate now implemented, exact threshold still open

**Customer says**: `11_Quan_ly_hop_dong`'s status column names an 11-stage sequence —
DRAFT → REVIEW → APPROVED → SENT → SIGNED → **PAYMENT** → ACTIVE → **AMENDED** → COMPLETED →
LIQUIDATED → ARCHIVED — implying PAYMENT and AMENDED are Contract-level statuses in their
own right, and that ACTIVE is reached only after a PAYMENT stage.

**Current implementation**: `ContractStatus` enum still has 9 values (schema.prisma) — no
PAYMENT or AMENDED status value exists. Payment remains modeled as a separate child entity
(`Payment`, 1:N off Contract) with its own `PaymentStatus`; Amendment remains a separate
`ContractAmendment` audit-trail entity + `Contract.version` counter. **What changed in this
remediation phase (GAP-002, GAP-007)**: `ContractsService.updateStatus` now enforces that
SIGNED → ACTIVE requires at least one `Payment` with status PARTIALLY_PAID or PAID (409
`PAYMENT_REQUIRED_FOR_ACTIVATION` otherwise), and that ACTIVE → COMPLETED requires no
unresolved (PENDING/PARTIALLY_PAID/OVERDUE) payment remaining (409
`OUTSTANDING_DEBT_REMAINS`). See `docs/ASSUMPTIONS.md` ASM-88.

**Difference remaining**: The *functional consequence* the customer's sequence implies (no
activation without payment) is now real and enforced. The *literal modeling* difference is
not — PAYMENT and AMENDED still don't exist as `ContractStatus` values, and **the customer
never specified whether "PAYMENT" means a deposit, a specific percentage, or payment in
full** before activation is allowed. This implementation chose "at least one payment
actually received (any amount)" as the minimal defensible reading — see ASM-88's reasoning
— not because the customer confirmed that threshold.

**Current DECISION/ASSUMPTION**: ASM-88 (this phase) — ASM-88 records the *engineering*
decision for the threshold actually implemented; it is explicitly not presented as the
client's confirmed intent.

**Impact**: Low for AMENDED (the audit-trail need is fully met via the amendment/version
mechanism, just not as a status value — no client action needed here). Medium for PAYMENT —
if the client actually intended a stricter rule (e.g. "the first installment specifically"
or "full payment before service begins" or "a minimum percentage"), the current "any amount
received" gate would incorrectly allow activation in a case the client would have wanted
blocked.

**Recommendation**: Confirm the exact activation threshold with the client:
(a) any payment received (current implementation), (b) a specific installment/deposit
threshold, or (c) full payment. If (b) or (c), the fix is a one-line change to the
`receivedCount` query in `ContractsService.updateStatus` — no architectural change needed.
Separately, confirm whether the client needs PAYMENT/AMENDED to exist as literal
`ContractStatus` enum values (a real schema/UI change) or is satisfied by the current
functional equivalent (Payment/ContractAmendment as separate, correctly-linked entities).

**Customer acceptance required**: YES.

---

## CONFLICT-002 — SYSTEM_ADMIN role not named in customer sheets 02/03

**Customer says**: 7 roles total, exhaustively listed in sheet02 (GĐĐH, Trưởng phòng, Tư
vấn, Hồ sơ, Sale/Marketing, HCTH, HS/PHHS).

**Current implementation**: An 8th `RoleCode`, `SYSTEM_ADMIN`, exists — narrowly scoped to
`users`/`audit_logs`/`jobs` administration, zero business-data grants. Unchanged by this
remediation phase.

**Difference**: A platform/IT-operations role outside the customer's business-role
taxonomy.

**Current DECISION/ASSUMPTION**: None found in `docs/DECISIONS.md`/`docs/ASSUMPTIONS.md`
addressing this specific role's existence against the customer's exhaustive 7-role list.

**Impact**: Low — the role carries zero business-data exposure and satisfies the customer's
own Offboarding/Session-Control requirements (sheet09), which need *some*
identity-administration actor. But it was never reviewed against the customer's explicit,
closed role list.

**Recommendation**: Formally document SYSTEM_ADMIN's existence and scope for client
sign-off; no code change needed unless the client objects.

**Customer acceptance required**: YES (a documentation/sign-off gap, not a functional one).

---

## CONFLICT-003 — "Đối tác chỉ xem dữ liệu được chia sẻ theo từng case" (sheet09 row18) — ambiguous scope

**Customer says**: Partner access is restricted to data shared per-case.

**Current implementation**: No external partner-facing login/portal exists anywhere —
Partner is purely an internal-staff-managed CRM record set. Internally,
`PartnersService.list/getById` apply no case-ownership filter at all — every role holding
any `partners:view` grant sees every Partner row globally. Unchanged by this remediation
phase.

**Difference**: The requirement is genuinely ambiguous between two readings: (a) an
*external* partner-login control (in which case it's NOT_APPLICABLE — no such login surface
exists to scope), or (b) an *internal staff* case-scoping rule (in which case it's a real,
unaddressed gap — internal roles currently see all partners regardless of case relevance).

**Current DECISION/ASSUMPTION**: None found addressing which reading was intended.

**Impact**: Low if reading (a) was intended (nothing to fix); Medium if reading (b) was
intended (a real internal over-exposure, though bounded by role-permission gating, not a
raw data leak to unauthorized roles).

**Recommendation**: Ask the client directly which reading was intended; if (b), add a
case-scope filter to Partner list/read queries analogous to `ScopePolicyService`'s existing
Student/Contract/Case filters.

**Customer acceptance required**: YES.

---

## New conflict-adjacent item surfaced during this remediation phase

### GAP-020/GAP-021 role-provisioning findings (from the original audit) — not conflicts, but still open

Not re-litigated here since they were already correctly classified as MEDIUM
gaps (not formal conflicts) in `docs/requirements/CLIENT_REQUIREMENTS_GAPS.md` — Sale/
Marketing and HCTH/Consultant under-provisioned on a few "Hạn chế" (restricted, not zero)
module cells. Left untouched in this remediation phase per the explicit instruction to fix
only the 6 named blockers before any MEDIUM/LOW item.

---

## CONFLICT-004 — `Student.gpa` "Required" (sheet04) vs. "Optional" (sheet17) — source document contradicts itself

**Found during:** Re-Audit Round 2 (2026-08-25), re-verifying `assertStudentProfileComplete`
(GAP-004/GAP-005's enforcement gate) against the Excel a second time.

**Customer says (contradictory):** `04_Student_Profile` row6: "GPA | GPA theo năm/kỳ | Tư vấn
cập nhật | **Bắt buộc**" (Required). `17_Data_Dictionary` row7: "Student | gpa | Decimal | |
Staff | **Optional**". These are the same field described twice, with opposite
required-ness, in two different sheets of the same customer workbook.

**Current implementation:** `AssessmentsService.assertStudentProfileComplete` follows the
stricter sheet04 reading — it hard-blocks Assessment approval unless at least one
`AcademicRecord` has both `grade` AND `gpa` set (409 `STUDENT_PROFILE_INCOMPLETE`, GPA named
explicitly in the missing-fields list).

**Difference:** Not an implementation gap — the two source sheets disagree with each other.
The remediation silently picked the stricter of the two readings rather than flagging the
contradiction, because at the time GAP-004/GAP-005 were scoped from sheet04 only.

**Current DECISION/ASSUMPTION:** None — this contradiction was not previously surfaced in
`docs/ASSUMPTIONS.md` or `docs/DECISIONS.md`.

**Impact:** Low either way functionally (the implementation enforces the stricter option,
which is the safer default for a mandatory-sounding field), but the source documents
disagree and the client should be told, rather than us silently picking a side.

**Recommendation:** Tell the client both sheets exist and disagree; ask them to correct
whichever sheet is wrong. No code change recommended unless they say GPA should in fact be
optional.

**Customer acceptance required:** YES (documentation correction, not urgent).

---

Do not resolve any of the three CONFLICT items above by code change without explicit client
confirmation of the intended interpretation — implementing a guess here would itself become
a new, undisclosed assumption baked into production behavior.
