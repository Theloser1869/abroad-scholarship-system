# PHASE F01 – FRONTEND AUDIT + ARCHITECTURE

Đọc `00-context/00_FRONTEND_MASTER_CONTEXT.md`, SRS, docs/REQUIREMENTS_TRACEABILITY.md, API_CONVENTIONS, RBAC_MATRIX, backend controllers/DTOs và repository hiện tại.

Mục tiêu:
- audit frontend hiện có
- xác định stack/framework
- xác định monorepo boundary
- map API thật
- map domain/route
- thiết kế frontend architecture
- không xây business feature lớn

Tạo:
- docs/frontend/FRONTEND_ARCHITECTURE.md
- docs/frontend/FRONTEND_API_MAP.md
- docs/frontend/FRONTEND_PERMISSION_MAP.md
- docs/frontend/FRONTEND_ROUTES.md
- docs/frontend/FRONTEND_BUILD_STATUS.md

Kiểm tra:
- framework
- package manager
- TS config
- styling
- component library
- routing
- server/client rendering
- API base URL
- auth/session mechanism
- testing setup

Nếu frontend chưa có:
- chọn stack phù hợp với repo hiện tại; ưu tiên Next.js + TypeScript nếu không có constraint khác.

Không triển khai business domain ở phase này.

Validation:
- install
- typecheck
- lint
- build

Final:
PHASE F01 STATUS: PASS/FAIL/BLOCKED
READY FOR F02: YES/NO
