# PHASE F10 – FRONTEND QA + SECURITY + UAT

Mục tiêu: chứng minh frontend không phá backend security hoặc business workflows.

Đọc:
- SRS
- REQUIREMENTS_TRACEABILITY
- RBAC_MATRIX
- SECURITY_TEST_REPORT
- frontend route/permission/api maps

TEST ROLE EXPERIENCE
- Executive Director
- Department Manager
- Consultant
- Application/Document Specialist
- Sales/Marketing
- Administration/Finance
- Student
- Parent
- System Admin

SECURITY
- 401 handling
- 403 handling
- route guard
- IDOR attempts
- cross-student
- cross-case
- cross-partner
- parent unlinked
- revoked parent
- hidden fields
- document download
- export access

API CONTRACT
- no guessed endpoints
- no inconsistent DTO handling
- no duplicate API client logic

UAT workflows:
Lead → Student → Case → Contract → Assessment/Roadmap → Application → Offer/Scholarship → Visa → Enrollment → Closure

Do not fabricate business records in production solely to make tests pass.

Regression:
- frontend tests
- backend full regression
- typecheck
- lint
- production build

Create:
- docs/frontend/FRONTEND_SECURITY_REVIEW.md
- docs/frontend/FRONTEND_UAT_FINDINGS.md
- docs/frontend/phase-status/PHASE_F10.md

Final gate:
CRITICAL = 0
HIGH = 0
No known sensitive data exposure.
