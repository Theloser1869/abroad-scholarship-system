# PHASE F04 – CONTRACT + PAYMENT + COUNSELING/PROFILE

Đọc backend APIs tương ứng Phase 05 và Phase 07.

CONTRACT
- list/detail
- status timeline
- review/approval
- secure review state
- signing state
- version history
- amendment history
- immutable signed/final UX

PAYMENT
- installment schedule
- paid/outstanding/overdue
- partial payment display
- refund/waive action only when authorized
- currency formatting
- no client-side final money calculation

ASSESSMENT
- current/target/gap
- criteria
- version history
- review/approval

ROADMAP
- horizon/timeline
- milestones
- owner
- target/metric
- dependencies
- progress
- task links

PROFILE EVIDENCE
- academic
- tests
- competitions
- research
- activities/leadership
- evidence document links

WRITING
- artifact list
- editor/viewer
- version history
- review/comments visibility
- final/submitted state
- LOR tracking

Quy tắc:
- immutable versions không bị overwrite
- money từ backend source-of-truth
- documents đi qua existing signed access flow
- internal fields phải hidden theo role/field policy

Validation + checkpoint PHASE_F04.
