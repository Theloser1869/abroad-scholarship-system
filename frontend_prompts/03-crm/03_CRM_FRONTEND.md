# PHASE F03 – CRM: LEAD + STUDENT + CASE

Đọc F01/F02 docs và backend API thật.

Xây frontend cho:

LEAD
- list/search/filter
- detail
- create/edit
- owner assignment
- status transitions
- convert
- notes/timeline

STUDENT
- list/search/filter
- detail/360 view
- contacts
- cases
- timeline
- role-aware fields

CASE
- list/filter
- detail
- stage/status
- owner/member management
- tasks summary
- timeline
- closure entry point

Yêu cầu UX:
- Student 360 là context trung tâm cho staff
- Case detail phải cho thấy lifecycle liên quan
- status changes gọi dedicated backend action
- permissions kiểm tra trước khi hiển thị mutation controls
- không cho frontend sửa status bằng generic PATCH nếu backend không cho

Không duplicate data model.
Không fake data trong production flow.

Validation:
- CRM component tests
- permission visibility
- form validation
- API integration
- build/typecheck/lint

Checkpoint:
docs/frontend/phase-status/PHASE_F03.md
