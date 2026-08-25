# Hệ thống Quản lý Du học & Học bổng

Hệ thống CRM nội bộ quản lý toàn bộ vòng đời tư vấn du học/học bổng — từ Lead, ký hợp đồng, đánh giá năng lực, xây roadmap, phát triển hồ sơ, ứng tuyển, xin học bổng, xin visa, đến nhập học và thanh lý hợp đồng — kèm theo Cổng thông tin (Portal) riêng cho Học sinh/Phụ huynh và một module CRM đối tác (trường/tổ chức học bổng/agent) có theo dõi hoa hồng.

Dự án được triển khai theo 21 sheet yêu cầu gốc của khách hàng (`docs/He_thong_quan_ly_du_hoc_hoc_bong.xlsx`) và SRS đầy đủ (`docs/SRS_He_thong_quan_ly_du_hoc_hoc_bong.docx`).

## Trạng thái hiện tại

**Client Acceptance: PASS WITH CONDITIONS** (vòng Re-Audit thứ 2). Toàn bộ hồ sơ nghiệm thu — ma trận 130 yêu cầu, các gap còn tồn đọng, 4 conflict cần khách hàng xác nhận, và gói tài liệu xác nhận chính thức — nằm tại [`docs/requirements/`](docs/requirements/):

- [`CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md`](docs/requirements/CLIENT_ACCEPTANCE_REAUDIT_ROUND2.md) — báo cáo nghiệm thu mới nhất
- [`CLIENT_ACCEPTANCE_MATRIX.md`](docs/requirements/CLIENT_ACCEPTANCE_MATRIX.md) — đối chiếu từng yêu cầu với evidence trong code
- [`CLIENT_REQUIREMENTS_GAPS.md`](docs/requirements/CLIENT_REQUIREMENTS_GAPS.md) — danh sách gap còn mở, xếp theo mức độ nghiêm trọng
- [`CLIENT_CLARIFICATION_SIGNOFF.md`](docs/requirements/CLIENT_CLARIFICATION_SIGNOFF.md) — các quyết định nghiệp vụ cần khách hàng xác nhận trước khi đóng các gap còn lại

## Kiến trúc & Công nghệ

Monorepo dùng npm workspaces, gồm 2 ứng dụng:

| | Công nghệ | Thư mục |
|---|---|---|
| **Backend API** | NestJS 11 + Prisma 6 + PostgreSQL | `apps/api` |
| **Frontend** | Next.js 16 (App Router) + Tailwind CSS 4 | `apps/web` |
| **Database** | PostgreSQL, schema/migration dùng chung | `database/` |

Điểm nhấn kiến trúc:
- **RBAC hai lớp**: phân quyền theo vai trò (8 role) + phân quyền theo phạm vi bản ghi (Case Ownership, `ScopePolicyService`) + field-level redaction cho dữ liệu nhạy cảm (`FieldPolicyService`).
- **Audit log đầy đủ**: mọi hành động VIEW/EDIT/DOWNLOAD/EXPORT/SHARE đều ghi log qua `AuditInterceptor`, bao gồm cả các lượt bị từ chối.
- **Business ID tách biệt UUID**: mọi entity có cả UUID (khóa chính, dùng cho authorization) lẫn mã nghiệp vụ tự sinh (`HS-2026-00001`, `HD-2026-00001`...) — không authorization nào dựa trên mã nghiệp vụ.
- **Migration chỉ cộng thêm (additive-only)**: không có migration phá vỡ dữ liệu hiện có trong toàn bộ lịch sử dự án.
- **Tài liệu không public URL**: mọi file đều đi qua download được proxy qua backend, kiểm tra quyền + trạng thái scan trước khi trả về.

## Bắt đầu (Local Development)

### Yêu cầu
- Node.js 22.x
- Docker (chạy PostgreSQL local)

### 1. Cài đặt

```bash
npm install
```

### 2. Khởi động PostgreSQL local

```bash
docker compose up -d
```

### 3. Cấu hình môi trường

```bash
cp .env.example .env
```

Giá trị mặc định trong `.env.example` đã trỏ đúng vào Postgres local (`localhost:55432`) và `STORAGE_PROVIDER=local` — không cần sửa gì thêm cho dev. **Lưu ý riêng cho `PORT`**: để trống dòng `PORT=` hoàn toàn (không để `PORT=` rỗng) — `main.ts` dùng `process.env.PORT ?? process.env.API_PORT ?? 3000`, và `??` chỉ fallback khi giá trị là `null`/`undefined`, không fallback khi là chuỗi rỗng.

### 4. Migrate + seed dữ liệu demo

```bash
npm run db:migrate:dev
npm run db:seed
```

Seed tạo sẵn 11 tài khoản demo (một tài khoản cho mỗi vai trò, một số case/lead/task mẫu). Mật khẩu cho **mọi** tài khoản demo: `DemoPass!123`.

| Username | Vai trò |
|---|---|
| `demo.director` | Giám đốc điều hành |
| `demo.manager` | Trưởng phòng |
| `demo.consultant.a` / `demo.consultant.b` | Nhân viên tư vấn |
| `demo.docspecialist` | Nhân viên xử lý hồ sơ |
| `demo.sales` / `demo.sales.b` | Sale/Marketing |
| `demo.finance` | HCTH (Hành chính - Tài chính) |
| `demo.student.self` | Học sinh (Portal) |
| `demo.parent.linked` / `demo.parent.unlinked` | Phụ huynh (Portal) |

### 5. Chạy dev server

```bash
npm run api:start      # backend — http://localhost:3000
npm run web:dev         # frontend — http://localhost:3001
```

Đăng nhập tại `http://localhost:3001/login` bằng một trong các tài khoản demo ở trên.

## Cấu trúc thư mục

```text
apps/
  api/                # NestJS backend — 1 module/domain nghiệp vụ (contracts, cases, visas, partners...)
  web/                # Next.js frontend — (staff) = CRM nội bộ, (portal) = Cổng học sinh/phụ huynh
database/
  schema.prisma       # schema duy nhất, dùng chung cho toàn hệ thống
  migrations/         # lịch sử migration, additive-only
  seeds/               # seed.ts — tài khoản demo + dữ liệu mẫu
docs/
  requirements/        # ma trận nghiệm thu, gap, conflict, tài liệu xác nhận khách hàng
  architecture/        # kiến trúc hệ thống
  security/            # RBAC matrix, các nguyên tắc bảo mật
  frontend/            # route map, quy ước frontend
  api/                 # API conventions
  database/            # data dictionary, ERD
  ASSUMPTIONS.md        # mọi giả định kỹ thuật khi yêu cầu chưa rõ, có đánh số ASM-XX
  DECISIONS.md          # quyết định kiến trúc khi phát hiện yêu cầu mâu thuẫn
```

## Kiểm thử

```bash
npm run api:test          # backend unit tests
npm run api:test:e2e      # backend e2e (yêu cầu Postgres local đang chạy)
npm run web:test          # frontend tests
npm run api:typecheck && npm run web:typecheck
npm run api:lint && npm run web:lint
```

**Lưu ý khi chạy e2e trên Windows**: chạy tuần tự (`jest --runInBand`) thay vì mặc định song song — bộ e2e test dùng chung một database, và trên Windows có một bug đã biết (`jest-worker EPERM: kill`) khiến tiến trình worker không tắt sạch giữa các lần chạy, gây tràn connection nếu chạy nhiều lần liên tiếp ở chế độ song song.

## Triển khai (Production)

Xem [`docs/DEPLOYMENT_ENV.md`](docs/DEPLOYMENT_ENV.md) (biến môi trường production) và [`docs/DEPLOYMENT_FREE.md`](docs/DEPLOYMENT_FREE.md) (hướng dẫn deploy free-tier: frontend trên Vercel, backend + Postgres trên Render).

**Không bao giờ** trỏ `DATABASE_URL`/`DIRECT_URL` local vào production, và không chạy `prisma migrate reset` ngoài môi trường dev đã xác nhận.

## Vai trò & phân quyền

Hệ thống có 7 vai trò nghiệp vụ theo yêu cầu khách hàng (Giám đốc điều hành, Trưởng phòng, Tư vấn, Xử lý hồ sơ, Sale/Marketing, HCTH, Học sinh/Phụ huynh) cộng 1 vai trò kỹ thuật nội bộ (`SYSTEM_ADMIN`, không có quyền truy cập dữ liệu nghiệp vụ nào — xem `docs/requirements/CLIENT_REQUIREMENT_CONFLICTS.md` CONFLICT-002 để biết vì sao vai trò này chưa được khách hàng chính thức xác nhận). Ma trận phân quyền đầy đủ theo module nằm tại `docs/security/`.

## Tài liệu tham khảo khác

- `docs/PROJECT_STRUCTURE.md` — giải thích chi tiết cấu trúc thư mục
- `docs/PHASE_MAP.md` — lịch sử các phase triển khai
- `docs/REQUIREMENTS_TRACEABILITY.md` — truy vết yêu cầu gốc → code
- `docs/FINAL_ARCHITECT_REVIEW.md` — đánh giá kiến trúc tổng thể cuối kỳ
