# ARCHITECTURE DECISIONS

Phase: 01B – Target Architecture
Date: 2026-08-18

Format mỗi quyết định: ID, context, options, decision, reason, impact (đúng khuôn mẫu `docs/DECISIONS.md`
gốc, áp dụng riêng cho quyết định kiến trúc).

---

## ARCH-DEC-01 — Kiểu kiến trúc tổng thể

**Context**: Repository là greenfield, cần chọn giữa microservices và modular monolith trước khi Phase 02
dựng nền tảng DB/API.

**Options**:
1. Microservices theo từng domain (identity, crm, case-management, ...).
2. Modular monolith: một backend, module hóa nghiêm ngặt theo domain boundary.

**Decision**: Modular monolith (option 2).

**Reason**: SRS mục 17 chỉ yêu cầu "domain modules tách theo business capability" trong một backend
framework, không yêu cầu service riêng. README/MASTER_CONTEXT cấm tạo microservice "chỉ vì trông chuyên
nghiệp". 5 trục dữ liệu xuyên suốt (Case, Student, Contract, Document, Task — SRS mục 19) có quan hệ FK
chặt giữa các domain, và có transaction nghiệp vụ xuyên domain bắt buộc (Lead → Contract → Student + Case,
SRS mục 6.2) — modular monolith cho phép dùng DB transaction thật, tránh distributed transaction phức tạp
không cần thiết ở giai đoạn P0–P6.

**Impact**: Toàn bộ `apps/api` là một deployable unit. Domain boundary phải được enforce bằng convention/
lint (không cho import chéo internal giữa module), không phải bằng network boundary. Có thể tách thành
service riêng sau này nếu một domain cụ thể cần scale độc lập — quyết định này không phải vĩnh viễn.

---

## ARCH-DEC-02 — Gộp "Counseling" và "Profile Development" thành một domain vật lý

**Context**: Đề bài Phase 01B liệt kê domain boundary tối thiểu gồm cả "Counseling" và "Profile
Development" như hai mục riêng, nhưng SRS không có ranh giới module nào tương ứng với "Profile
Development" độc lập khỏi Assessment/Roadmap/Academic/Test/Competition/Research/Activity/Writing
(SRS mục 4, M05–M11) — tất cả các module này cùng thuộc nhóm "quản trị phát triển hồ sơ học sinh trước
admission" và dùng chung entity `Case`/`Student` context.

**Options**:
1. Tạo hai domain code riêng biệt: `counseling` và `profile-development`, tự chia nhỏ M05–M11 giữa hai
   domain đó.
2. Gộp thành một domain vật lý `counseling`, giữ "Profile Development" như tên nghiệp vụ/label không map
   1-1 với module code.

**Decision**: Option 2.

**Reason**: SRS không cung cấp ranh giới rõ ràng để chia M05–M11 thành hai nhóm entity tách biệt; tự suy
diễn ranh giới đó vi phạm nguyên tắc "Không tự suy diễn requirement nếu tài liệu đã quy định" và có nguy
cơ tạo hai domain có entity/khái niệm trùng lặp (vi phạm Hard Rule "Không tạo entity trùng tên hoặc trùng
ý nghĩa" áp dụng ở mức domain). README mục PROJECT_STRUCTURE cũng không liệt kê `profile-development` như
một module `apps/api/modules/` riêng — chỉ có `counseling`.

**Impact**: `apps/api/modules/counseling/` sở hữu toàn bộ Assessment, Roadmap, RoadmapMilestone,
AcademicRecord, TestRecord, Competition, ResearchProject, Activity, WritingArtifact, WritingVersion.
Phase 07 (đặt tên "profile" trong PHASE_MAP: "Assessment + Roadmap + Evidence + Writing") sẽ implement vào
domain `counseling` này, không tạo module `profile` riêng. Đã ghi assumption tương ứng vào
`docs/ASSUMPTIONS.md`.

---

## ARCH-DEC-03 — University/Program/ScholarshipMaster là master data thuộc domain `admission`, tách biệt Partner

**Context**: SRS mục 14 (dòng 759) tự cảnh báo: "University, Program, Scholarship Master chưa được chuẩn
hóa thành master data. Không nên dùng Partner làm thay thế University trong mọi trường hợp."

**Options**:
1. Coi University như một dạng đặc biệt của Partner (tái dùng bảng Partner).
2. Tách hoàn toàn: University/Program/ScholarshipMaster là entity riêng, độc lập với Partner/
   PartnerProgram, cùng thuộc domain `admission`.

**Decision**: Option 2.

**Reason**: SRS mục 7 (Data Model) đã liệt kê `University`, `Program`, `ScholarshipMaster` như entity
độc lập với `Partner`, `PartnerProgram` — có field khác nhau hoàn toàn (University: ranking/admissions
URL; Partner: type/country_code/commission). `00_MASTER_CONTEXT.md` cũng liệt kê cả hai nhóm entity tách
biệt trong Core Entities. Gộp chung sẽ vi phạm Hard Rule #1/#2 (không duplicate entity) theo hướng ngược
— nhồi hai khái niệm khác nhau vào một bảng.

**Impact**: Domain `admission` sở hữu University/Program/ScholarshipMaster như master data có
`verified_by`/`last_verified_at` (SRS mục 6.9), tách biệt hoàn toàn khỏi domain `partners`. Contract/
Program có thể tham chiếu `partner_program_id` như FK tùy chọn khi nghiệp vụ cần (xem gap đã ghi ở
REPOSITORY_AUDIT mục 5.6) — quyết định bắt buộc/tùy chọn cụ thể sẽ chốt ở Phase 05/08, không chốt ở đây.

---

## ARCH-DEC-04 — Document là domain dùng chung (shared), không thuộc sở hữu bất kỳ domain nghiệp vụ nào

**Context**: SRS mục 19 xác định Document là 1 trong 5 trục dữ liệu xuyên suốt, được tham chiếu bởi hầu
hết module (Application checklist, Visa evidence, Contract signed artifact, Writing artifact, evidence
Assessment/Competition/Research/Activity).

**Options**:
1. Mỗi domain tự quản lý file/metadata riêng cho nhu cầu của mình (VD: `commercial` tự có bảng lưu file
   hợp đồng đã ký).
2. Một domain `documents` duy nhất sở hữu `Document`/`DocumentAccess`; mọi domain khác chỉ giữ FK
   `document_id`.

**Decision**: Option 2.

**Reason**: SRS mục 6.19 yêu cầu metadata thống nhất (document_id, owner entity, type, version,
file_reference, mime_type, size, uploaded_by, uploaded_at, status), cộng với retention/virus-scan/
checksum dùng chung cho mọi loại tài liệu. Phân tán logic này vào từng domain sẽ vi phạm nguyên tắc
Single Source of Truth (SRS mục 2) và tạo nguy cơ một số domain quên áp dụng kiểm soát bảo mật (signed
URL, audit) mà các domain khác có.

**Impact**: Domain `documents` là nơi duy nhất được phép gọi object storage SDK. Mọi domain khác coi
Document là read-mostly reference. Chi tiết boundary tại TARGET_ARCHITECTURE mục 4 và mục 15.

---

## ARCH-DEC-05 — E-signature provider: chưa chọn, để ngỏ như một tích hợp thay thế được (mở)

**Context**: SRS mục 6.16 yêu cầu "Gửi client review bằng secure link có expiry; signed document lưu
immutable" nhưng mục 14 (dòng 769) tự nêu: "Cần xác định quy trình e-signature thực tế nếu tích hợp:
provider, webhook, signing evidence, certificate/audit" — đây là gap thật sự còn mở trong SRS, không có
resolution.

**Options**:
1. Chốt ngay một provider cụ thể (VD: DocuSign, HelloSign...) ở Phase 01.
2. Không chốt provider ở Phase 01; định nghĩa interface `SigningProvider` trong domain `commercial`,
   implementation cụ thể để ngỏ cho Phase 05 (Commercial) hoặc Phase 12 (Platform/Integrations) quyết
   định, có thể bắt đầu bằng flow thủ công (upload file đã ký ngoài hệ thống) nếu chưa có provider.

**Decision**: Option 2.

**Reason**: SRS không quy định provider cụ thể; MASTER_CONTEXT cấm "silently invent business rules" —
việc tự chọn một provider thương mại cụ thể ở Phase 01 là suy diễn ngoài phạm vi tài liệu. Domain
boundary (ARCH-DEC integration) đã đảm bảo việc trì hoãn quyết định này không ảnh hưởng thiết kế domain
`commercial`.

**Impact**: Contract có thể chuyển Signed bằng luồng thủ công (staff upload file đã ký, được lưu như
Document immutable + audit) cho đến khi Phase 05 quyết định có tích hợp e-signature provider thật hay
không. Đã ghi assumption liên quan vào `docs/ASSUMPTIONS.md`.

---

## ARCH-DEC-06 — Tech stack khuyến nghị của SRS được giữ nguyên làm ràng buộc kiến trúc, không đổi ở Phase 01

**Context**: SRS mục 17 khuyến nghị stack cụ thể (React/Next.js + TypeScript, NestJS/FastAPI, PostgreSQL,
S3-compatible, Redis/BullMQ, OAuth2/OIDC hoặc local auth+MFA, Docker/CI-CD).

**Options**:
1. Chốt framework/version cụ thể ngay ở Phase 01B.
2. Chỉ khóa ràng buộc kiến trúc (PostgreSQL relational core, type-safe, migration-only, private storage,
   async queue) ở Phase 01B; để Phase 02 (Foundation) chọn framework/ORM/version cụ thể khi khởi tạo
   project thật.

**Decision**: Option 2.

**Reason**: Phase 01 (Discovery) theo `01-discovery/02_TARGET_ARCHITECTURE.md` chỉ yêu cầu xác định
boundary (frontend/backend/database/storage/queue/auth/audit/reporting/integrations) và ownership —
không yêu cầu chọn version cụ thể của framework. Việc chọn version cụ thể thuộc phạm vi Phase 02
(`02-foundation/01_DATABASE_FOUNDATION.md`, `02_API_FOUNDATION.md`) theo đúng PHASE_MAP. Quyết định sớm
version cụ thể ở đây là vượt phạm vi scope Phase 01 ("Không triển khai feature ngoài phạm vi phase hiện
tại" áp dụng tương tự cho quyết định kỹ thuật thuộc phase sau).

**Impact**: Không blocking cho Phase 01. Phase 02 sẽ đọc lại `TARGET_ARCHITECTURE.md` mục 16 làm ràng
buộc đầu vào khi chọn framework/ORM/migration tool cụ thể.
