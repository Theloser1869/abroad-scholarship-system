# PHASE 01A – REPOSITORY AUDIT

Đọc toàn bộ repository trước khi sửa code.

## Yêu cầu

Xác định:
- framework
- frontend
- backend
- database
- ORM
- auth
- storage
- jobs/queue
- tests
- CI/CD
- env config
- existing entities
- routes
- API
- pages/components
- current RBAC

Đọc toàn bộ SRS.

Tạo:
`docs/REPOSITORY_AUDIT.md`

Phải có:
1. Current architecture
2. Existing features
3. Missing features
4. Partial features
5. Technical debt
6. Security risks
7. Duplicate entities/concepts
8. Migration risks
9. Recommended build order

KHÔNG:
- rewrite toàn bộ repo
- xóa code chỉ vì không đẹp
- xây feature mới ở phase này

Kết thúc bằng PASS/FAIL.
