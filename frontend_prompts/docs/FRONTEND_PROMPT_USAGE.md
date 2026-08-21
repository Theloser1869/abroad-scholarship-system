# FRONTEND PROMPT USAGE

1. Đảm bảo bộ backend Phase 01–14 đã ổn định.
2. Đưa thư mục `frontend_prompts` vào repository hệ thống hoặc giữ nguyên path truy cập.
3. Bắt đầu bằng `00-context/00_FRONTEND_MASTER_CONTEXT.md`.
4. Chạy từng phase theo `docs/FRONTEND_PHASE_MAP.md`.
5. Không gửi toàn bộ 11 prompt trong một lần.
6. Sau mỗi phase đọc final report và chỉ tiếp tục khi `PASS` + `READY`.
7. Khi có discrepancy giữa UI expectation và backend API, inspect backend trước; không tự tạo API giả.

### Mẫu prompt chuyển phase

Đọc và thực hiện file `<path-to-next-prompt>`.
Đọc checkpoint của các frontend phase trước và backend Phase 01–14.
Không triển khai scope phase sau.
Chạy validation.
Tạo/cập nhật checkpoint.
Cuối cùng báo PASS/FAIL/BLOCKED và READY phase tiếp theo.
