# TARGET ARCHITECTURE

Phase: 01B – Target Architecture
Date: 2026-08-18
Nguồn: `docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx` (toàn văn) + `docs/REPOSITORY_AUDIT.md` +
`00-context/00_MASTER_CONTEXT.md`.

## 0. Kiểu kiến trúc: Modular Monolith

**Quyết định**: Modular monolith (một backend service, chia module theo domain boundary rõ ràng), không
phải microservices.

**Lý do**:
- SRS mục 17 chỉ khuyến nghị "domain modules tách theo business capability" bên trong một backend
  (NestJS/Node.js hoặc FastAPI), không yêu cầu tách service vật lý.
- README/MASTER_CONTEXT nói rõ: "Không tạo microservice chỉ vì 'trông chuyên nghiệp'. Nếu modular
  monolith phù hợp hơn, chọn modular monolith."
- Ở giai đoạn P0–P6 (SRS mục 16), toàn bộ nghiệp vụ xoay quanh 5 trục dữ liệu dùng chung
  (Case, Student, Contract, Document, Task — SRS mục 19) với quan hệ tham chiếu chặt (FK) giữa gần như
  mọi module. Tách microservice sớm sẽ buộc phải giải quyết distributed transaction/consistency cho các
  luồng xuyên trục (VD: Lead → Contract → Student + Case là một transaction nghiệp vụ, SRS mục 6.2) —
  không cần thiết ở quy mô/độ trưởng thành hiện tại (NFR-SCAL-01 chỉ yêu cầu "không redesign core" khi
  tăng volume, không yêu cầu scale độc lập theo service).
- Modular monolith vẫn cho phép tách thành service riêng sau này theo domain boundary nếu cần (đường lui
  rõ ràng), miễn là domain boundary được giữ nghiêm ngặt ngay từ đầu (không gọi thẳng vào internal của
  module khác, không share table giữa hai domain khác nhau).

Xem chi tiết boundary theo domain tại `docs/architecture/DOMAIN_MAP.md`.

## 1. Frontend boundaries

- Một ứng dụng web duy nhất (`apps/web`), desktop-first cho staff, responsive cho student/parent portal,
  tiếng Việt mặc định (NFR-UX-01).
- Frontend **không tự quyết định authorization** — chỉ phản ánh policy trả về từ backend (MASTER_CONTEXT:
  "Backend phải kiểm authorization"; SRS mục 2: "Các phép export/download phải kiểm tra quyền ở
  server-side, không chỉ ẩn nút trên UI").
- Tổ chức theo `features/` ánh xạ 1-1 với domain (không theo role) để tránh trùng lặp UI giữa các role
  xem cùng một entity với field-level khác nhau (SRS mục 13 — ma trận field-level theo 7 role).
- Portal Student/Parent (SRS mục 11, Phase 11) là một **surface riêng trong cùng app** (route/guard
  riêng), không phải app tách biệt, vì dùng chung phần lớn domain model và authorization engine.

## 2. Backend / domain boundaries

Modular monolith `apps/api`, tổ chức `modules/` theo domain boundary (xem `DOMAIN_MAP.md`):

```
apps/api/modules/
├─ identity/        (Auth, RBAC, Audit nền tảng)
├─ crm/              (Lead)
├─ case-management/  (Student, Case, CaseMember, Task, TaskDependency)
├─ counseling/        (Assessment, Roadmap, RoadmapMilestone, AcademicRecord, TestRecord,
│                      Competition, ResearchProject, Activity, WritingArtifact, WritingVersion)
├─ profile/           (alias hạ tầng dùng chung cho counseling — xem ghi chú DOMAIN_MAP)
├─ admission/         (University, Program, ScholarshipMaster, UniversityChoice, Application,
│                      ApplicationChecklist, Offer, ScholarshipApplication)
├─ visa/              (Visa, Pre-departure/Enrollment thuộc tính trong Visa domain)
├─ commercial/        (Contract, ContractTemplate, ContractAmendment, Payment)
├─ partners/          (Partner, PartnerProgram, PartnerDocument, PartnerStudentLink,
│                      CommissionRule, CommissionTransaction)
├─ documents/         (Document, DocumentAccess)
├─ notifications/     (Notification, Comment, Approval)
└─ reporting/         (đọc dữ liệu tổng hợp cross-domain, KHÔNG sở hữu bảng nghiệp vụ nào)
```

Mỗi module chỉ được truy cập dữ liệu module khác qua **domain service interface** (application layer),
không query thẳng bảng của module khác. Domain logic tách khỏi presentation/API layer (MASTER_CONTEXT:
"Domain logic separated from presentation").

`common/` chứa cross-cutting: ID generator, versioning helper, audit interceptor, RBAC guard,
signed-URL helper, master-data access.

## 3. Database boundary

- **Một** PostgreSQL instance logic cho toàn hệ thống (SRS mục 17: "PostgreSQL; transaction integrity").
  Không tách DB theo module ở giai đoạn này — modular monolith dùng chung DB nhưng **schema/table
  ownership vẫn thuộc về đúng một module** (mỗi bảng có đúng một module "chủ sở hữu ghi"; module khác chỉ
  đọc qua service interface hoặc qua FK read-only).
- Entity cốt lõi (40 entity ở SRS mục 7 / MASTER_CONTEXT) phải **normalize**; JSONB chỉ dùng cho field mở
  rộng/metadata linh hoạt (checklist item tùy biến theo trường, custom field cấu hình), không dùng JSONB
  để né việc thiết kế quan hệ (SRS mục 17).
- Migration-only: mọi thay đổi schema đi qua migration tool được chọn ở Phase 02 (Hard Rule README:
  "Không sửa schema thủ công ngoài migration").
- Soft delete/archive cho bản ghi có giá trị pháp lý/audit (Contract, Document, Payment, Visa, AuditLog…)
  — không hard-delete (Hard Rule #5).

## 4. Storage (Documents)

- Private object storage S3-compatible, **không public bucket** (SRS mục 17, NFR-SEC-04, Hard Rule #6).
- Download/preview/share luôn qua **signed URL ngắn hạn** được cấp sau khi authorization pass, và mỗi lần
  cấp phải ghi audit (SRS mục 6.19, mục 21, AC-04).
- `Document` là entity metadata trong PostgreSQL (nguồn sự thật cho quyền/version/status); file nhị phân
  nằm trong object storage, tham chiếu qua `file_reference` — không bao giờ lưu path/URL tĩnh công khai
  trong DB.
- Domain `documents` sở hữu `Document`, `DocumentAccess`; các domain khác (Contract, Visa, Application…)
  chỉ giữ FK tới `document_id`, không tự quản lý file.

## 5. Queue / workers

- Redis/BullMQ (hoặc tương đương) cho: notification dispatch, file virus/malware scan trước khi Document
  chuyển Active/Approved (SRS mục 6.19), export xử lý bất đồng bộ khi dữ liệu lớn (NFR-PERF-01: "thao tác
  file xử lý bất đồng bộ nếu cần"), reminder theo rule-based schedule (30/14/7/3/1 ngày — SRS mục 6.20).
- `workers/` tách theo: `notifications/`, `documents/` (scan/thumbnail), `exports/`, `integrations/`
  (theo `docs/PROJECT_STRUCTURE.md` khuyến nghị) — mỗi worker chỉ gọi vào domain service interface tương
  ứng, không truy cập DB ngoài phạm vi domain của nó.
- Queue là **async boundary** chính thức giữa "ghi transaction nghiệp vụ" (đồng bộ, trong request) và
  "hiệu ứng phụ" (gửi email, quét file, xuất báo cáo) — transaction nghiệp vụ không được chờ các tác vụ
  này để commit.

## 6. Notification

- Domain `notifications` sở hữu `Notification`, `Comment`, `Approval`. Recipient resolution (owner,
  collaborator, manager, student/PHHS) là logic domain, không hard-code trong worker (SRS mục 6.20).
- Kênh: in-app + email bắt buộc; SMS/Zalo/WhatsApp là integration tùy chọn qua `integrations` (nằm trong
  `platform`/Phase 12) — không nhúng logic gửi SMS trực tiếp vào domain notifications (giữ domain logic
  tách khỏi transport).
- Không gửi dữ liệu nhạy cảm trực tiếp trong subject/body — ưu tiên secure link (SRS mục 6.20).

## 7. Auth / RBAC

- Domain `identity` là **nguồn sự thật duy nhất** cho `User`, `Role`, `Permission`, `RolePermission`,
  session, MFA.
- Authorization = RBAC (role + action + resource) **kết hợp** record scope + case ownership/membership +
  field-level rule (MASTER_CONTEXT SECURITY; SRS mục 2, mục 13). Đây không phải RBAC phẳng — cần một
  **policy engine chung** (không lặp lại logic if/else theo role ở từng module) mà mọi module gọi qua
  cùng một guard/interceptor.
- Deny-by-default (NFR-SEC-01): mọi endpoint mặc định deny trừ khi có permission rõ ràng.
- Backend luôn re-check authorization kể cả khi client gọi thẳng API (không tin frontend).

## 8. Audit

- Domain `identity` (hoặc cross-cutting `common/audit`, sở hữu bởi `identity` để giữ một nguồn sự thật)
  sở hữu `AuditLog`. Mọi module khác **ghi audit qua một interface chung** (audit interceptor ở API
  layer), không tự viết logic ghi audit riêng lẻ — tránh format audit không nhất quán.
- Audit append-only, không cho admin xóa tùy tiện (NFR-SEC-05, Hard Rule #5 áp dụng cho AuditLog).
- Bắt buộc ghi audit cho: VIEW (dữ liệu nhạy cảm), EDIT (kèm before/after diff), DOWNLOAD, EXPORT, SHARE,
  DELETE, LOGIN (SRS mục 1, mục 21).

## 9. Reporting

- Domain `reporting` **không sở hữu bảng nghiệp vụ nào** — chỉ đọc (read-only, qua view/aggregation) từ
  các domain khác để dựng dashboard GĐĐH/Trưởng phòng/cá nhân/student portal (SRS mục 6.21, mục 11).
- KPI phải tính từ dữ liệu transaction thực (Task/Case gốc), không cho phép nhập tay số liệu KPI
  (SRS AC-15) — đây là ràng buộc thiết kế quan trọng cho Phase 12.
- PostgreSQL full-text search ban đầu; Elastic/OpenSearch chỉ khi volume lớn (SRS mục 17) — không triển
  khai search engine riêng ở giai đoạn P0–P6 trừ khi có yêu cầu phát sinh.

## 10. Integrations

- `integrations` là ranh giới async/boundary riêng trong `platform` (Phase 12): e-signature, email
  provider, SMS/Zalo/WhatsApp, calendar, payment/accounting (SRS mục 18, backlog P2).
- Không thiết kế coupling trực tiếp giữa domain nghiệp vụ (VD: `commercial` cho Contract) và một provider
  cụ thể — domain gọi qua interface (VD: `SigningProvider`), implementation cụ thể nằm ở `integrations`.
  Điều này cho phép domain logic không đổi khi đổi provider.
- E-signature: **chưa có provider được chọn trong SRS** (SRS mục 14 dòng 769 tự nêu đây là gap). Ghi
  nhận là quyết định mở — xem `docs/architecture/DECISIONS.md` (ARCH-DEC-05) và sẽ cần assumption cụ thể
  khi Phase 05 (Commercial) triển khai signature flow.

## 11. Source of truth / ownership (tổng hợp)

| Domain | Sở hữu (ghi) | Được đọc bởi |
|---|---|---|
| identity | User, Role, Permission, RolePermission, AuditLog | tất cả domain (qua interface) |
| crm | Lead | case-management (khi convert) |
| case-management | Student, StudentContact, Case, CaseMember, Task, TaskDependency | hầu hết domain (case_id là FK phổ biến) |
| counseling | Assessment, Roadmap, RoadmapMilestone, AcademicRecord, TestRecord, Competition, ResearchProject, Activity, WritingArtifact, WritingVersion | admission (school selection dùng profile), reporting |
| admission | University, Program, ScholarshipMaster, UniversityChoice, Application, ApplicationChecklist, Offer, ScholarshipApplication | visa (chọn nơi nhập học), reporting |
| visa | Visa | reporting |
| commercial | Contract, ContractTemplate, ContractAmendment, Payment | case-management (kích hoạt Case), partners (commission trigger), reporting |
| partners | Partner, PartnerProgram, PartnerDocument, PartnerStudentLink, CommissionRule, CommissionTransaction | reporting |
| documents | Document, DocumentAccess | mọi domain (qua FK document_id) |
| notifications | Notification, Comment, Approval | mọi domain (trigger event) |
| reporting | (không sở hữu bảng nghiệp vụ) | — |

Nguyên tắc: mỗi entity trong danh sách 40 Core Entities (MASTER_CONTEXT / SRS mục 7) có **đúng một** domain
sở hữu ghi. Domain khác cần dữ liệu đó phải đi qua service interface hoặc FK read-only — không được tạo
bảng "bản sao" cùng ý nghĩa ở domain khác (tránh vi phạm Hard Rule "Không tạo entity trùng tên hoặc trùng
ý nghĩa").

## 12. Transaction boundaries

- Transaction DB (ACID) chỉ bọc trong phạm vi **một domain** ở phần lớn trường hợp.
- Ngoại lệ được nghiệp vụ yêu cầu rõ ràng — **Lead → Contract → Student + Case** (SRS mục 6.2: "Khi hợp
  đồng được ký, hệ thống tạo Student ID, Case và liên kết Contract; không để nhân viên nhập lại dữ liệu
  đã có") là một transaction nghiệp vụ xuyên domain (`crm` + `commercial` + `case-management`). Đây phải
  được implement như một **application-level saga/orchestration trong cùng DB transaction** (vì cùng một
  PostgreSQL instance, có thể dùng DB transaction thật, không cần distributed transaction) do một service
  điều phối (đặt ở `case-management` vì đây là domain sở hữu Student/Case, kết quả cuối của flow).
- Mọi transaction xuyên domain khác (VD: Roadmap approve yêu cầu Assessment baseline tồn tại — SRS mục
  6.5) nên implement dưới dạng **validate trước, ghi sau trong cùng transaction**, không dùng eventual
  consistency cho ràng buộc nghiệp vụ cứng (hard constraint).

## 13. Async boundaries

Ranh giới bất đồng bộ (qua queue, không đồng bộ trong request/response):
- Gửi notification (email/in-app) sau khi entity đổi trạng thái.
- Virus/malware scan file trước khi Document → Active/Approved.
- Export dữ liệu lớn (SRS mục 21: export phải log reason/filter/row count/fields/actor/result — việc ghi
  log audit là đồng bộ, nhưng việc tạo file export lớn có thể bất đồng bộ).
- Deadline reminder theo lịch (cron/schedule).
- Commission calculation trigger (khi payment/application đạt điều kiện) có thể async nếu tính toán phức
  tạp, nhưng **ghi nhận CommissionTransaction ở trạng thái Pending phải đồng bộ** để không mất giao dịch.

Mọi thứ ảnh hưởng trực tiếp đến tính đúng của một transaction nghiệp vụ (VD: tạo Student ID khi ký hợp
đồng) **không được** đưa vào async boundary.

## 14. Integration boundaries

- Domain nghiệp vụ không gọi trực tiếp SDK của bên thứ ba. Mọi tích hợp ngoài đi qua `integrations`
  module với interface do domain định nghĩa (dependency inversion) — ví dụ `commercial` định nghĩa
  `SigningProvider`, `notifications` định nghĩa `MessageChannel`.
- Webhook từ bên ngoài (VD: e-signature callback) đi vào qua `integrations`, được xác thực (signature
  verification), sau đó gọi vào domain service tương ứng qua interface nội bộ — không update thẳng bảng
  domain từ webhook handler.

## 15. Security boundaries

- Authorization boundary nằm ở **API layer** (guard/interceptor dùng chung), áp dụng trước khi vào bất kỳ
  domain service nào — không có domain service nào tự ý bỏ qua bước này kể cả khi được gọi nội bộ giữa
  các module (internal call vẫn phải truyền principal + kiểm tra scope).
- Field-level security boundary nằm ở **serialization layer** (response mapping) — dữ liệu nhạy cảm
  (passport, finance, contract value, payment/debt, commission, visa evidence, internal notes) bị lọc
  theo role + field policy trước khi trả ra khỏi service layer, không lọc ở frontend (SRS mục 13).
- Document access boundary: mọi request lấy signed URL phải qua `documents` domain, domain này là nơi
  duy nhất được phép gọi object storage SDK để sinh signed URL.
- Audit boundary: audit interceptor đặt ở API layer, ghi log **trước khi trả response** cho các action
  nhạy cảm — không dựa vào domain tự giác ghi audit.

## 16. Tech stack (theo khuyến nghị SRS mục 17, chưa final — xem `DECISIONS.md`)

| Layer | Lựa chọn khuyến nghị |
|---|---|
| Frontend | React/Next.js, TypeScript |
| Backend | NestJS/Node.js (hoặc FastAPI), TypeScript ưu tiên để type-safe end-to-end |
| Database | PostgreSQL |
| File storage | S3-compatible, private bucket + signed URL |
| Queue | Redis/BullMQ |
| Search | PostgreSQL full-text (giai đoạn đầu) |
| Auth | OAuth2/OIDC nếu có IdP doanh nghiệp; local auth + MFA nếu chưa có |
| Observability | structured logs + metrics + tracing |
| Deployment | Docker; CI/CD với migration/test/security-scan/backup check |

Việc chốt stack cụ thể (framework version, ORM cụ thể) thuộc phạm vi **Phase 02 (Foundation)**, không
phải Phase 01. Ở đây chỉ khóa **ràng buộc kiến trúc** (PostgreSQL relational core, type-safe, migration
tool bắt buộc, private storage) theo đúng MASTER_CONTEXT/ENGINEERING RULES.
