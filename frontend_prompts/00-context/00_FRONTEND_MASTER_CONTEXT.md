# FRONTEND MASTER CONTEXT

Hãy coi repository backend hiện tại, SRS và tài liệu Phase 01–14 là nguồn sự thật.

Mục tiêu: xây frontend production-quality, permission-aware, responsive và tích hợp API thật.

Backend đã có:
- Auth / session
- RBAC / scope / field policy
- Audit
- Lead / Student / Case
- Contract / Payment
- Task / Notification
- Assessment / Roadmap / Profile / Writing
- University / Program / Scholarship / Application / Offer
- Visa / Pre-departure / Enrollment
- Partner / Commission
- Documents / R2 / signed URL
- Reporting
- Student / Parent Portal

Frontend không được:
- tự tạo business state machine
- tự tính final financial amount
- tự quyết định authorization
- chứa secret, DB URL, R2 credential
- truy cập private R2 bucket trực tiếp
- dùng mock data thay API thật trong production flow

Frontend phải:
- dùng centralized API client
- dùng typed DTO/response model
- có auth bootstrap
- có centralized permission helpers
- có loading/error/empty/403/404/401 states
- pagination/filter server-side khi backend hỗ trợ
- giữ version/history của các entity immutable
- route/page theo permission
- không expose internal fields của Student/Parent

8 role:
1. EXECUTIVE_DIRECTOR
2. DEPARTMENT_MANAGER
3. CONSULTANT
4. APPLICATION_DOCUMENT_SPECIALIST
5. SALES_MARKETING
6. ADMIN_FINANCE
7. STUDENT_PARENT
8. SYSTEM_ADMIN

Không tự đổi role code nếu backend dùng tên khác. Inspect source trước.
