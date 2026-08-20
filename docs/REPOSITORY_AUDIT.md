# REPOSITORY AUDIT

Phase: 01A – Repository Audit
Date: 2026-08-18
Nguồn: toàn bộ repository hiện tại + `docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx` (đã đọc toàn văn 19 mục).

## 0. Phương pháp

Đã liệt kê toàn bộ cây thư mục gốc và kiểm tra sự tồn tại của mọi artefact mã nguồn thường gặp
(`package.json`, `*.sln`, `pom.xml`, thư mục `apps/`, `src/`, `.git/`, CI config...). Không tìm thấy
artefact mã nguồn nào. Repository hiện tại **không phải** một dự án phần mềm đã khởi tạo — đây là một
"prompt pack" (bộ tài liệu điều phối) dùng để dẫn dắt Claude Code triển khai tuần tự theo phase.

## 1. Current architecture

Không có codebase nào tồn tại. Cụ thể:

| Hạng mục | Trạng thái |
|---|---|
| Framework (frontend) | Không có |
| Framework (backend) | Không có |
| Database | Không có (chưa có schema, chưa có migration engine được chọn) |
| ORM | Không có |
| Auth | Không có |
| Storage (object storage) | Không có |
| Jobs/Queue | Không có |
| Tests | Không có |
| CI/CD | Không có (không có `.github/workflows`, không có pipeline config nào) |
| Env config | Không có (`.env`, `.env.example` không tồn tại) |
| Existing entities | Không có (chưa có schema/model nào được định nghĩa trong code) |
| Routes / API | Không có |
| Pages/Components | Không có |
| Current RBAC | Không có |
| Git | Repository **chưa được khởi tạo** (`Is a git repository: false`) |

Nội dung repo hiện tại chỉ gồm:
- `README.md` — bản đồ phase và quy tắc điều phối cho Claude Code.
- `00-context/00_MASTER_CONTEXT.md` — business context, core entities, roles, hard rules, ID scheme.
- `01-discovery/` … `14-production/` — các prompt theo phase (chưa phase nào được thực thi).
- `checkpoints/` — checklist hoàn thành phase + quy trình khôi phục khi implement sai.
- `docs/` — `PROJECT_STRUCTURE.md`, `PHASE_MAP.md`, `CLAUDE_PROMPT_USAGE.md`, `ASSUMPTIONS.md` (trống),
  `DECISIONS.md` (trống), và `SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx` (nguồn yêu cầu nghiệp vụ, 19 mục,
  đã đọc toàn văn ở phase này).

**Kết luận**: đây là điểm khởi đầu "sạch" (greenfield). Không có kiến trúc hiện hữu nào cần audit ở mức
code; audit tập trung vào tài liệu và tính nhất quán giữa các nguồn requirement.

## 2. Existing features

Không có feature nào đã được implement. SRS mô tả 23 module chức năng (M01–M23, SRS mục 4) và 14 giai
đoạn vòng đời (S0–S13, SRS mục 5) — tất cả đang ở trạng thái đặc tả, chưa có dòng code nào.

## 3. Missing features

Toàn bộ 23 module trong SRS mục 4 đều thiếu, bao gồm các trục dữ liệu cốt lõi mà SRS mục 19 nhấn mạnh:
**Case, Student, Contract, Document, Task**, và các module mở rộng: Lead/CRM, Assessment, Roadmap,
Academic/Test, Competition/Research/Activity, Writing Portfolio, University/Program/Scholarship Master,
Application, Offer, Scholarship Application, Visa, Pre-departure/Enrollment, Contract & Payment,
Partner CRM, Task/KPI, Document Management, Notification, Audit/Reporting, Identity & Access (Auth/RBAC).

Đây là input cho "Recommended build order" (mục 9 dưới đây) và đã được README/PHASE_MAP hoạch định thành
14 phase (02–14).

## 4. Partial features

Không có — không có gì được triển khai một phần vì chưa có code.

## 5. Technical debt

Không có technical debt kỹ thuật (không có code). Tuy nhiên có "documentation debt" cần xử lý trước khi
code production, đúng như SRS mục 14 (Kết luận mục 19) tự liệt kê:

1. **Chuẩn Student ID chưa nhất quán trong tài liệu nguồn gốc** (SRS mục 14, dòng 755): workbook nguồn có
   hai định dạng ví dụ khác nhau (`HS-YYYY-NNNNN` và `RIVA-2026-00025`). SRS đã tự đề xuất chốt theo
   `HS-YYYY-NNNNN`, và `00_MASTER_CONTEXT.md` đã áp dụng đúng định dạng này. → Không phải mâu thuẫn đang
   mở, đã có resolution nhất quán giữa SRS và Master Context.
2. **Case entity chưa có Data Dictionary chi tiết trong workbook gốc** (SRS mục 14, dòng 756) dù là đối
   tượng trung tâm. SRS mục 7 đã bổ sung entity `Case` với các field tối thiểu; `00_MASTER_CONTEXT.md`
   cũng đã liệt kê `Case`, `CaseMember` trong Core Entities. → Đã có model đề xuất, cần giữ nguyên ở Phase
   02 (Foundation)/Phase 04 (Core CRM).
3. **Lead/CRM chưa có Data Dictionary gốc** (dòng 757) — đã được SRS mục 7 bổ sung entity `Lead`.
4. **Assessment/Roadmap/Milestone chưa có entity chi tiết** trong nguồn gốc (dòng 758) — đã bổ sung ở
   SRS mục 7 (`Assessment`, `Roadmap`, `RoadmapMilestone`).
5. **University/Program/Scholarship Master chưa chuẩn hóa** thành master data trong nguồn gốc (dòng 759).
6. **Contract thiếu FK `partner_program_id`** dù nghiệp vụ có nhắc đến quan hệ này (dòng 760) — cần quyết
   định khi triển khai Phase 05 (Commercial) liệu FK này là bắt buộc hay optional.
7. **Payment model quá tối giản** trong nguồn gốc, thiếu installment/paid amount/currency/method/
   receipt/partial/refund (dòng 761) — đã được SRS mục 6.16 và mục 7 bổ sung đầy đủ.
8. **Document thiếu access-control entity, MIME/size/hash, retention, audit diff** (dòng 762) — đã bổ
   sung `DocumentAccess` ở SRS mục 7 và yêu cầu chi tiết ở mục 6.19.
9. **Writing/Essay/Resume/LOR/SOP thiếu data model version/comment** (dòng 763) — đã bổ sung
   `WritingArtifact`/`WritingVersion` ở SRS mục 7.
10. **Notification và Approval chưa có data model gốc** (dòng 764) — đã bổ sung `Notification`, `Approval`
    ở SRS mục 7.
11. **User/Role/Permission thiếu bảng `RolePermission`, field policy, scope/case policy** trong nguồn gốc
    (dòng 765) — đã bổ sung ở SRS mục 7.
12. **Partner CRM cần tách rõ Partner/Partner Program; commission cần transaction model riêng** (dòng 766)
    — đã có `CommissionRule` và `CommissionTransaction` tách biệt ở SRS mục 7.
13. **Thiếu master data cho country/region, university, major, intake, test type, document type,
    scholarship type, currency, payment method** (dòng 767) — cần được thiết kế thành bảng cấu hình được
    (configurable), không hard-code, đúng nguyên tắc SRS mục 2 và MASTER_CONTEXT.
14. **Chưa xác định source of truth cho dữ liệu trường/chương trình/học bổng** và ai được cập nhật trực
    tiếp (dòng 768) — cần quyết định ở Phase 01B (Target Architecture) / Phase 08 (Admission).
15. **Quy trình e-signature chưa xác định provider/webhook/signing evidence** nếu tích hợp (dòng 769) —
    ngoài phạm vi bắt buộc của SRS (không có AC nào yêu cầu e-sign cụ thể), ghi nhận là **rủi ro/khoảng
    trống** cần assumption khi đến Phase 05 (Commercial – Contract).

**Ghi chú quan trọng**: Tất cả các điểm 1–13 ở trên **đã được chính SRS (bản v1.0 đang đọc) giải quyết**　
bằng cách bổ sung entity/field còn thiếu ở mục 7 và các mục chi tiết 6.x. SRS mục 14 là phần "changelog"
ghi lại các gap đã tồn tại ở workbook Excel gốc (nguồn thô), không phải gap còn tồn đọng trong chính văn
bản SRS này. Vì vậy các điểm này **không được ghi vào `docs/DECISIONS.md` như mâu thuẫn đang mở** — chúng
đã có resolution rõ ràng và nhất quán với `00_MASTER_CONTEXT.md`. Riêng điểm 14 và 15 (source of truth
cho master data ngoại vi, và e-signature) là các quyết định kiến trúc còn mở thật sự và sẽ được xử lý ở
`docs/architecture/DECISIONS.md` (Phase 01B) và `docs/ASSUMPTIONS.md` khi các phase liên quan
(01B, 05, 08) triển khai.

## 6. Security risks

Vì chưa có implementation, đây là risk ở mức yêu cầu — cần được Phase 03 (Security) và các phase sau
tuân thủ nghiêm ngặt, dựa trên SRS mục 3, 12, 13 và MASTER_CONTEXT mục SECURITY/HARD RULES:

1. Authorization phải là **server-side, deny-by-default** (NFR-SEC-01) — không được chỉ ẩn UI.
2. MFA bắt buộc cho tài khoản nội bộ (NFR-SEC-03).
3. File riêng tư **không được có public URL** — chỉ signed URL ngắn hạn (NFR-SEC-04, Hard Rule #6).
4. Audit phải bất biến/append-only cho các thao tác nhạy cảm: VIEW/EDIT/DOWNLOAD/EXPORT/SHARE/DELETE/
   LOGIN (SRS mục 1, mục 21; NFR-SEC-05).
5. Field-level permission bắt buộc cho: passport/ID, tài chính/budget, contract value, payment/debt,
   commission, visa evidence, internal notes (SRS mục 13) — đây là ma trận quyền chi tiết theo 7 role,
   không thể đơn giản hóa thành RBAC phẳng.
6. Không hard-delete bản ghi có giá trị pháp lý/audit (Hard Rule #5); dùng soft delete/archive.
7. Không overwrite bản ghi đã ký/final (Hard Rule #4) — Document/Contract phải versioned.
8. Rate limiting cho login/API để chống brute-force, CSRF/XSS/SQL injection (NFR-SEC-06).
9. Offboarding phải thu hồi toàn bộ role/token/quyền tải file ngay lập tức (SRS mục 6.1, AC-14).
10. Password/secret/token không được log ở dạng plaintext (SRS mục 6.1).

Vì đây là hệ thống greenfield, các risk trên hiện là **yêu cầu thiết kế bắt buộc** hơn là lỗ hổng thực
tế — cần đưa vào Phase 02 (API/DB conventions) và Phase 03 (Auth/RBAC/Audit) làm nền tảng bắt buộc trước
khi bất kỳ module nghiệp vụ nào được xây (đúng khuyến nghị SRS mục 16, P0 – Foundation).

## 7. Duplicate entities/concepts

Không phát hiện duplicate entity/concept nào giữa `00_MASTER_CONTEXT.md` (Core Entities) và SRS mục 7
(Data Model đề xuất). Đối chiếu 1-1:

- Cả hai đều định nghĩa đúng 1 entity cho mỗi khái niệm nghiệp vụ: `Student` (không tách theo quốc gia/
  chương trình), `Contract` (độc lập, amendment thay vì bản ghi mới), `Partner` (1 partner – nhiều
  `PartnerProgram`) — đúng nguyên tắc SRS mục 1 (Student ID xuyên suốt vòng đời, Contract ID độc lập,
  Partner ID với nhiều Partner Program).
- `University` không bị dùng lẫn với `Partner` (SRS mục 14 dòng 759 cảnh báo rõ: "Không nên dùng Partner
  làm thay thế University trong mọi trường hợp") — MASTER_CONTEXT đã tách hai entity này rõ ràng.
- `CommissionRule` và `CommissionTransaction` tách biệt khỏi `Payment` (thanh toán học sinh) — đúng SRS
  mục 6.17 ("Commission phải tách khỏi student payment").

Danh sách 40 Core Entities trong `00_MASTER_CONTEXT.md` khớp đầy đủ với 40 entity trong SRS mục 7 (không
thiếu, không thừa, không đặt tên khác nhau cho cùng một khái niệm).

## 8. Migration risks

Vì đây là hệ thống mới hoàn toàn (không có dữ liệu production, không có schema cũ), rủi ro migration
theo nghĩa "chuyển đổi dữ liệu cũ" không tồn tại ở phase này. Rủi ro cần lưu ý cho các phase sau:

1. **Rủi ro thiết kế schema sai ngay từ đầu**: vì Case, Lead, Assessment, Roadmap, Notification, Approval
   chưa từng có Data Dictionary trong nguồn workbook gốc, Phase 02 (Database Foundation) phải dùng đúng
   entity/field đã được SRS mục 7 chuẩn hóa, tránh tự sáng tạo field ngoài phạm vi.
2. **Rủi ro ID format không nhất quán khi sinh dữ liệu thật**: phải implement bộ sinh ID tập trung
   (`HS-YYYY-NNNNN`, `HD-YYYY-NNNNN`, …) ngay từ Phase 02 để tránh việc từng module tự sinh ID theo cách
   khác nhau — rủi ro cao nếu để đến các phase sau mới chuẩn hóa.
3. **Rủi ro không thể mở rộng nếu chọn sai kiến trúc lưu trữ tài liệu** (public bucket vs private + signed
   URL) — phải quyết định đúng ngay từ Phase 01B/02, vì đổi ngược lại sau khi có dữ liệu thật sẽ tốn kém
   và có rủi ro rò rỉ dữ liệu nhạy cảm trong lúc chuyển đổi.
4. **Rủi ro versioning muộn**: Document, Contract, Assessment, Roadmap, WritingArtifact đều yêu cầu
   version hóa ngay từ đầu (không ghi đè bản final/signed) — nếu Phase 02 không dựng cơ chế version chung
   sớm, các phase sau (05, 07, 12) sẽ phải retrofit, gây rủi ro migration lớn hơn.
5. **Không có CI/CD, không có migration tool được chọn** — Phase 02 phải chọn công cụ migration
   (ví dụ Prisma Migrate, Knex, Flyway, TypeORM migration...) và thiết lập ngay, vì mọi thay đổi schema
   sau này bắt buộc phải đi qua migration (Hard Rule "Không sửa schema thủ công ngoài migration").

## 9. Recommended build order

Khớp với `README.md` (mục 2, đã khóa cứng thứ tự phase) và SRS mục 16 (P0–P6) — không đề xuất thứ tự
khác. Xác nhận thứ tự đã định sẵn là hợp lý dựa trên phân tích phụ thuộc dữ liệu:

1. **02 Foundation** — DB + API conventions, ID generator, versioning cơ chế chung, migration tool.
   (Phụ thuộc: không.)
2. **03 Security** — Auth, RBAC, Audit. (Phụ thuộc: 02 — cần DB/User schema.)
3. **04 Core CRM** — Lead → Student → Case. (Phụ thuộc: 03 — cần ownership/case-scope authorization.)
4. **05 Commercial** — Contract + Payment (Lead chuyển đổi thành Contract → Student + Case, theo SRS
   mục 6.2). (Phụ thuộc: 04.)
5. **06 Operations** — Task + Notification (dùng chung cho mọi module sau). (Phụ thuộc: 04, 05.)
6. **07 Profile** — Assessment + Roadmap + Evidence + Writing. (Phụ thuộc: 04 — cần Case; roadmap approve
   yêu cầu assessment baseline theo SRS mục 6.4/6.5.)
7. **08 Admission** — University/Program/Scholarship Master + Application + Offer. (Phụ thuộc: 07 — school
   selection cần roadmap/profile.)
8. **09 Visa** — Visa + Pre-departure + Enrollment. (Phụ thuộc: 08 — visa cần offer/nhập học đã chọn.)
9. **10 Partners** — Partner CRM + Commission. (Phụ thuộc: 05, 08 — commission có thể gắn với
   contract/application.)
10. **11 Portal** — Student/Parent portal. (Phụ thuộc: hầu hết module trên vì portal tổng hợp dữ liệu.)
11. **12 Platform** — Documents + Jobs + Reporting. (Document nên có nền tảng sớm hơn về mặt hạ tầng ở
    Phase 02, nhưng module quản lý Document đầy đủ + reporting tổng hợp hợp lý đặt cuối vì cần dữ liệu từ
    mọi module khác để dashboard có ý nghĩa.)
12. **13 QA** — Traceability + Security review + UAT.
13. **14 Production** — Hardening + Final architecture review.

Không có đề xuất thay đổi thứ tự phase đã quy định trong README/PHASE_MAP. Repository audit không tìm
thấy lý do kỹ thuật nào để đảo thứ tự.

## PHASE 01A STATUS

PASS
