# PHASE F07 – DOCUMENTS + NOTIFICATIONS + REPORTING

DOCUMENTS
- file picker
- upload progress
- validation errors
- scan status
- clean/rejected states
- preview/download where permitted
- version list
- share/access state
- archive

Security:
- never use R2 credentials in browser
- never expose permanent object URLs
- download via backend authorization/signed token flow

NOTIFICATIONS
- inbox
- unread count
- mark read
- type/timestamp
- deep link to resource
- recipient-scoped only

REPORTING
Executive:
- pipeline
- cases
- revenue/receivables
- applications/scholarships/visa/enrollment
- bottlenecks

Manager:
- workload
- overdue
- approvals
- team metrics

Staff:
- /reports/me

Export:
- permission-aware
- reason-required
- progress if async
- download after backend authorization

Do not calculate dashboard KPI independently in frontend.

Validation:
- upload/download
- permission
- notifications
- report scope
- export UX
- build/typecheck/lint

Checkpoint PHASE_F07.
