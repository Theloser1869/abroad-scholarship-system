# PHASE 01B – TARGET ARCHITECTURE

Dựa trên SRS + repository audit.

Tạo:
- docs/architecture/TARGET_ARCHITECTURE.md
- docs/architecture/DOMAIN_MAP.md
- docs/architecture/DECISIONS.md

Thiết kế:
- frontend boundaries
- backend/domain boundaries
- database boundary
- storage
- queue/workers
- notification
- auth/RBAC
- audit
- reporting
- integrations

Domain boundaries tối thiểu:
Identity
CRM
Case Management
Counseling
Profile Development
Admission
Visa
Commercial
Partners
Documents
Notifications
Reporting

Không tạo microservice chỉ vì "trông chuyên nghiệp".
Nếu modular monolith phù hợp hơn, chọn modular monolith.

Phải xác định:
- source of truth
- ownership
- transaction boundaries
- async boundaries
- integration boundaries
- security boundaries
