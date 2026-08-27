# Client Requirement Conflicts

Companion to `docs/requirements/CLIENT_ACCEPTANCE_MATRIX.md` and the Client Acceptance
Remediation (Blocker Fix Phase). These are the 4 formal CONFLICT items identified across the
original Client Acceptance Audit and Re-Audit Round 2 — genuine divergences between the
customer Excel (`docs/He_thong_quan_ly_du_hoc_hoc_bong.xlsx`) and the implementation (or, for
CONFLICT-004, divergences within the Excel itself) that were **not** silently resolved by
assumption, per this phase's own explicit instruction. **CONFLICT-002 remains fully open**
(no code changed for it); **CONFLICT-001's payment-threshold sub-question was resolved
by direct client decision on 2026-08-27** (DEC-01 — at least 30% of Contract.value, net of
refunds) — its narrower literal-modeling sub-question (whether PAYMENT/AMENDED must exist as
`ContractStatus` enum values) remains open and requires client sign-off; **CONFLICT-003 was
fully resolved by direct client decision on 2026-08-27** (DEC-03 — Partner is company-wide
shared data, no case-scoping needed; current behavior already matched, no code change);
**CONFLICT-004 was resolved by direct client decision on 2026-08-25** (GPA = Optional) — see
its section below; the follow-up code mismatch that decision exposed (GAP-027) was fixed the
same day.

Do not treat any "Suggested resolution" below as already applied — each is a proposal
pending client confirmation.

---

## CONFLICT-001 — Contract status sequence (11 stages vs. 9 implemented; PAYMENT/AMENDED not modeled as statuses) — payment threshold RESOLVED (DEC-01, 2026-08-27); literal PAYMENT/AMENDED-as-status question still open

**Customer says**: `11_Quan_ly_hop_dong`'s status column names an 11-stage sequence —
DRAFT → REVIEW → APPROVED → SENT → SIGNED → **PAYMENT** → ACTIVE → **AMENDED** → COMPLETED →
LIQUIDATED → ARCHIVED — implying PAYMENT and AMENDED are Contract-level statuses in their
own right, and that ACTIVE is reached only after a PAYMENT stage.

**Current implementation**: `ContractStatus` enum still has 9 values (schema.prisma) — no
PAYMENT or AMENDED status value exists. Payment remains modeled as a separate child entity
(`Payment`, 1:N off Contract) with its own `PaymentStatus`; Amendment remains a separate
`ContractAmendment` audit-trail entity + `Contract.version` counter. **What changed in this
remediation phase (GAP-002, GAP-007)**: `ContractsService.updateStatus` enforces that
SIGNED → ACTIVE requires payment received on the contract (409
`PAYMENT_REQUIRED_FOR_ACTIVATION` otherwise), and that ACTIVE → COMPLETED requires no
unresolved (PENDING/PARTIALLY_PAID/OVERDUE) payment remaining (409
`OUTSTANDING_DEBT_REMAINS`). **2026-08-27 update (DEC-01):** the client directly answered
the exact threshold — **at least 30% of Contract.value received, net of refunds**. Below
30% is not sufficient regardless of how many payments exist. See `docs/ASSUMPTIONS.md`
ASM-88 (superseded) and `ACTIVATION_PAYMENT_THRESHOLD_RATIO` in `ContractsService`.

**Difference remaining**: The *functional consequence* the customer's sequence implies (no
activation without sufficient payment) is now real, enforced, and — as of DEC-01 — matches
a threshold the client explicitly chose, not an engineering guess. ~~the customer never
specified whether "PAYMENT" means a deposit, a specific percentage, or payment in full~~
**RESOLVED 2026-08-27: 30%, per DEC-01.** The *literal modeling* difference is still
open — PAYMENT and AMENDED still don't exist as `ContractStatus` enum values.

**Current DECISION/ASSUMPTION**: ~~ASM-88 (this phase) — ASM-88 records the *engineering*
decision for the threshold actually implemented; it is explicitly not presented as the
client's confirmed intent.~~ **DEC-01 (2026-08-27, client-confirmed) — 30% of Contract.value,
net of refunds. This is now the client's own confirmed intent, not an engineering
placeholder.** Whether PAYMENT/AMENDED need to exist as literal `ContractStatus` values
remains unassumed and unresolved.

**Impact**: Low for AMENDED (the audit-trail need is fully met via the amendment/version
mechanism, just not as a status value — no client action needed here). ~~Medium for
PAYMENT — if the client actually intended a stricter rule...~~ **RESOLVED for the threshold
itself (DEC-01). Remaining impact is now purely about whether PAYMENT/AMENDED need to be
literal enum values — Low, since the functional equivalent already exists and is enforced.**

**Recommendation**: ~~Confirm the exact activation threshold with the client...~~ **DONE —
30% confirmed via DEC-01, implemented and tested.** Still open: confirm whether the client
needs PAYMENT/AMENDED to exist as literal `ContractStatus` enum values (a real schema/UI
change) or is satisfied by the current functional equivalent (Payment/ContractAmendment as
separate, correctly-linked entities, now enforced at the client's own confirmed threshold).

**Customer acceptance required**: Partially — the threshold question is answered (DEC-01);
the literal-modeling question (PAYMENT/AMENDED as enum values) still needs a decision.

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

## CONFLICT-003 — "Đối tác chỉ xem dữ liệu được chia sẻ theo từng case" (sheet09 row18) — **RESOLVED 2026-08-27 (DEC-03)**

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

**Current DECISION/ASSUMPTION**: ~~None found addressing which reading was intended.~~
**DEC-03 (2026-08-27, client-confirmed):** reading (a) is correct — the requirement is about
a future external partner login, not internal staff. Quote: *"Không cần giới hạn Partner
theo Case. Partner là dữ liệu đối tác chung của công ty; nhân viên có quyền partners:view
được xem Partner theo phạm vi toàn công ty. Các dữ liệu/hoạt động nhạy cảm của Partner vẫn
được kiểm soát bằng permission và field-level access."*

**Impact**: ~~Low if reading (a) was intended (nothing to fix); Medium if reading (b) was
intended...~~ **Resolved as Low — reading (a) confirmed, nothing to fix. Current global-read
behavior is the client's own intended design, not an over-exposure.**

**Recommendation**: ~~Ask the client directly which reading was intended...~~ **DONE —
no code change needed. Sensitive Partner sub-data/actions (documents, commission rules/
transactions) remain controlled by their own existing permission and field-level rules,
unaffected by this decision.**

**Customer acceptance required**: ~~YES~~ **Received 2026-08-27.**

---

## New conflict-adjacent item surfaced during this remediation phase

### GAP-020/GAP-021 role-provisioning findings (from the original audit) — not conflicts, but still open

Not re-litigated here since they were already correctly classified as MEDIUM
gaps (not formal conflicts) in `docs/requirements/CLIENT_REQUIREMENTS_GAPS.md` — Sale/
Marketing and HCTH/Consultant under-provisioned on a few "Hạn chế" (restricted, not zero)
module cells. Left untouched in this remediation phase per the explicit instruction to fix
only the 6 named blockers before any MEDIUM/LOW item.

---

## CONFLICT-004 — `Student.gpa` "Required" (sheet04) vs. "Optional" (sheet17) — source document contradicts itself — **RESOLVED 2026-08-25 (client decision: Optional)**

**CLIENT DECISION (2026-08-25):** The client resolved this directly: **GPA is Optional**, not mandatory — the sheet17 reading wins over sheet04's "Bắt buộc." This decision surfaced a real, previously-unflagged mismatch: `AssessmentsService.assertStudentProfileComplete` (described below as "current implementation") still hard-blocked Assessment approval unless GPA was set, which was stricter than the confirmed requirement. Tracked as finding **GAP-027** in `CLIENT_REQUIREMENTS_GAPS.md` — **fixed 2026-08-25**: the `gpa: { not: null }` clause was dropped from the gate, keeping `grade: { not: null }`. `CLIENT_CLARIFICATION_SIGNOFF.md` DEC-04 updated accordingly. The original write-up below is left unmodified as the historical record of the conflict as originally found.

---

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

Do not resolve any of the CONFLICT items above by code change without explicit client
confirmation of the intended interpretation — implementing a guess here would itself become
a new, undisclosed assumption baked into production behavior. **CONFLICT-004 now has that
confirmation (2026-08-25, GPA = Optional), and the client separately asked for the follow-up
code change — see the resolution note in its own section above; GAP-027 is fixed.**
~~CONFLICT-001/002/003 remain open, unresolved by the client as of this writing.~~
**2026-08-27: CONFLICT-001's payment-threshold sub-question is now resolved (DEC-01 — 30%
of Contract.value, net of refunds) — only its literal PAYMENT/AMENDED-as-enum-value
sub-question remains open. CONFLICT-003 is now fully resolved (DEC-03 — no Partner
case-scoping needed). Only CONFLICT-002 (SYSTEM_ADMIN) remains fully open.**
