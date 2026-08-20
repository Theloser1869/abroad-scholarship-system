# PHASE 03C – AUDIT

Implement immutable-ish business audit trail.

Audit:
- actor
- action
- object_type
- object_id
- student/case
- timestamp
- IP
- user-agent
- result
- before
- after
- metadata

Audit sensitive:
VIEW
EDIT
DOWNLOAD
EXPORT
SHARE
DELETE
APPROVE
LOGIN
LOGOUT
PERMISSION_CHANGE

Build query/filter UI for authorized admins.

Test:
- every critical event creates audit
- failed unauthorized actions are auditable where appropriate
- ordinary users cannot delete logs
