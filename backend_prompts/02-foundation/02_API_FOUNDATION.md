# PHASE 02B – API FOUNDATION

Thiết lập conventions dùng chung.

API phải có:
- authentication context
- authorization context
- validation
- pagination
- filter
- sorting
- search
- error contract
- request ID
- audit hook
- consistent HTTP status
- idempotency strategy cho transaction-sensitive endpoint

Không triển khai tất cả business endpoint ở phase này.

Tạo:
docs/api/API_CONVENTIONS.md

Ví dụ:
GET /students
GET /students/:id
POST /students
PATCH /students/:id

Mọi endpoint sau này phải tuân theo convention này.
