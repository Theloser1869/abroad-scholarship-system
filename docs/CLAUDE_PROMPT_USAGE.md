# CÁCH VIẾT VÀ GIAO PROMPT CHO CLAUDE CODE

## Nguyên tắc 1 – Một prompt = một capability

Không yêu cầu:
"Xây toàn bộ hệ thống."

Thay vào đó:
"Implement Student + Case."

## Nguyên tắc 2 – Mỗi prompt phải có 5 phần

1. Context
2. Scope
3. Rules
4. Validation
5. Completion contract

Ví dụ:

```text
CONTEXT
Đọc SRS và implementation hiện tại.

SCOPE
Implement Student + Case.

RULES
Cross-case isolation.
No duplicate student.

VALIDATION
Migration + tests + RBAC tests + build.

COMPLETION
Báo cáo files, APIs, DB, tests, assumptions.
Không tự chuyển phase.
```

## Nguyên tắc 3 – Luôn khóa scope

Dùng câu:
"Do not implement unrelated features in this phase."

## Nguyên tắc 4 – Bắt Claude kiểm tra backend authorization

Không chấp nhận:
"Button này bị ẩn với user X."

Phải yêu cầu:
"API/service phải deny request dù user gọi endpoint trực tiếp."

## Nguyên tắc 5 – Bắt Claude test cả đường ALLOW và DENY

Mỗi permission quan trọng cần hai test:
- người được phép
- người không được phép

## Nguyên tắc 6 – Không cho Claude tự chuyển phase

Mỗi prompt kết thúc:
"Do not start the next phase."

## Nguyên tắc 7 – Khi yêu cầu mơ hồ

Không hỏi lại mọi thứ.

Claude phải:
- chọn assumption an toàn
- ghi vào docs/ASSUMPTIONS.md
- làm configurable nếu hợp lý

## Nguyên tắc 8 – Khi code sai

Dừng feature.
Dùng RECOVERY_FROM_WRONG_IMPLEMENTATION.md.
