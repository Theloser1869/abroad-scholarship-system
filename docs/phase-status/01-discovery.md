# PHASE STATUS — 01-discovery

## status
PASS

## scope
Phase 01A (Repository Audit) + Phase 01B (Target Architecture), theo `01-discovery/01_REPOSITORY_AUDIT.md`
và `01-discovery/02_TARGET_ARCHITECTURE.md`. Không có scope code/DB/API — đây là phase tài liệu/kiến trúc
thuần túy trước khi Phase 02 khởi tạo project thật.

## implemented
- Audit toàn bộ repository (không có codebase nào tồn tại — greenfield) và toàn văn SRS (19 mục).
- Xác định kiến trúc hiện tại, feature thiếu, technical/documentation debt, security risk (mức yêu cầu),
  duplicate-entity check (không phát hiện), migration risk, và recommended build order (xác nhận khớp
  README/PHASE_MAP, không đề xuất đổi thứ tự).
- Thiết kế Target Architecture: modular monolith, domain boundary cho 11 domain (Identity, CRM,
  Case Management, Counseling [gồm Profile Development], Admission, Visa, Commercial, Partners,
  Documents, Notifications, Reporting), source of truth/ownership, transaction/async/integration/security
  boundaries, và tech-stack constraint (chưa chốt version cụ thể — để Phase 02).
- Ghi nhận 3 assumption (không có mâu thuẫn requirement cần dừng feature).

## files changed
Tạo mới (không sửa/xóa file nào có sẵn):
- `docs/REPOSITORY_AUDIT.md`
- `docs/architecture/TARGET_ARCHITECTURE.md`
- `docs/architecture/DOMAIN_MAP.md`
- `docs/architecture/DECISIONS.md`
- `docs/ASSUMPTIONS.md` (cập nhật — thêm ASM-01, ASM-02, ASM-03 vào file template có sẵn)
- `docs/phase-status/01-discovery.md` (file này)

## migrations
Không áp dụng — chưa có database/migration tool nào được khởi tạo (thuộc Phase 02).

## API
Không áp dụng — chưa có backend nào được khởi tạo (thuộc Phase 02).

## UI
Không áp dụng — chưa có frontend nào được khởi tạo (thuộc Phase 02).

## tests
Không áp dụng — không có code để test. Validation của phase này là kiểm tra tính đầy đủ/nhất quán của
tài liệu đã tạo so với yêu cầu 2 file MD nguồn (xem mục "commands" bên dưới).

## assumptions
- ASM-01: "Profile Development" ánh xạ vào domain code `counseling`, không tạo module riêng.
- ASM-02: E-signature dùng luồng thủ công cho đến khi có quyết định provider cụ thể.
- ASM-03: Pre-departure/Enrollment chưa có entity riêng trong SRS mục 7; tạm thuộc domain `visa`, chốt
  chi tiết ở Phase 09.

Chi tiết đầy đủ tại `docs/ASSUMPTIONS.md`. Không có requirement mâu thuẫn cần dừng feature/ghi vào
`docs/DECISIONS.md` (root) — các gap trong SRS mục 14 đã có resolution nhất quán trong chính SRS + đã đối
chiếu khớp với `00_MASTER_CONTEXT.md` (xem `docs/REPOSITORY_AUDIT.md` mục 5).

## risks
Xem `docs/REPOSITORY_AUDIT.md` mục 6 (Security risks) và mục 8 (Migration risks) — tóm tắt:
- Cần policy engine authorization chung (role + scope + case ownership + field-level) ngay từ Phase 02/03,
  tránh mỗi module tự implement rời rạc.
- Cần ID generator + versioning helper dùng chung dựng sớm ở Phase 02, tránh retrofit tốn kém sau này.
- E-signature provider và entity Pre-departure/Enrollment chi tiết là quyết định còn mở, cần xử lý đúng
  lúc (Phase 05, Phase 09) — không phải rủi ro chặn Phase 02.

## known issues
Không có known issue kỹ thuật (chưa có code). Documentation debt đã liệt kê trong
`docs/REPOSITORY_AUDIT.md` mục 5 đã được resolve trong phạm vi tài liệu SRS hiện có; các mục còn mở
(ARCH-DEC-05 e-signature, ASM-03 pre-departure entity) đã được ghi nhận rõ, không phải "issue" mà là
"quyết định hoãn có chủ đích" đúng nguyên tắc CLAUDE_PROMPT_USAGE nguyên tắc 7.

## commands
Không có command build/test/lint/migration nào chạy được ở phase này (chưa có project code). Validation
thực hiện bằng cách:
- Đối chiếu từng mục bắt buộc trong `01_REPOSITORY_AUDIT.md` (9 mục: current architecture → recommended
  build order) — đã có đủ 9/9 mục trong `docs/REPOSITORY_AUDIT.md`.
- Đối chiếu từng mục bắt buộc trong `02_TARGET_ARCHITECTURE.md` (frontend/backend/db/storage/queue/
  notification/auth/audit/reporting/integrations + source of truth/ownership/transaction/async/
  integration/security boundaries) — đã có đủ trong `docs/architecture/TARGET_ARCHITECTURE.md`.
- Đối chiếu 40 Core Entities trong `00_MASTER_CONTEXT.md` với SRS mục 7 — khớp 1-1, không duplicate.
- Đối chiếu 11 domain boundary tối thiểu yêu cầu — đủ 11/11 trong `docs/architecture/DOMAIN_MAP.md`.

## next dependency
Phase 02 (Foundation — DB + API conventions) phụ thuộc vào:
- `docs/architecture/TARGET_ARCHITECTURE.md` mục 3 (database boundary: PostgreSQL, normalize core
  entity, migration-only) và mục 16 (tech stack constraint) làm đầu vào khi chọn framework/ORM/migration
  tool cụ thể.
- `docs/architecture/DOMAIN_MAP.md` làm cấu trúc thư mục `apps/api/modules/` khi khởi tạo project.
- Danh sách 40 Core Entities (SRS mục 7 / MASTER_CONTEXT) làm cơ sở thiết kế schema ban đầu — Phase 02
  không tự thêm/bớt entity ngoài danh sách này.

Không tự chuyển sang Phase 02. Chờ prompt tiếp theo.
