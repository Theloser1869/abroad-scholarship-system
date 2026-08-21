# PHASE 02A – DATABASE FOUNDATION

Implement database foundation từ SRS.

## Bắt buộc

Entities:
User
Role
Permission
RolePermission
Lead
Student
StudentContact
Case
CaseMember
Assessment
Roadmap
RoadmapMilestone
Task
TaskDependency
University
Program
ScholarshipMaster
Application
Document
Contract
ContractTemplate
ContractAmendment
Payment
Partner
PartnerProgram
PartnerDocument
AuditLog
Notification
Approval
Comment

Bổ sung entity nếu SRS yêu cầu.

## Quy tắc

- PK/FK đầy đủ
- unique constraints
- indexes
- timestamps
- soft delete/archive phù hợp
- business IDs immutable
- migration only
- normalized relational model
- JSONB chỉ cho metadata có lý do rõ

Tạo:
docs/database/ERD.md
docs/database/DATA_DICTIONARY.md

Run:
migration
seed
typecheck
tests
build
