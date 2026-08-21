# PHASE F11 – FRONTEND DEPLOYMENT READINESS

Mục tiêu: chuẩn bị frontend để deploy internal production, không tự deploy nếu user chưa yêu cầu.

Đọc:
- docs/DEPLOYMENT_FREE.md
- docs/DEPLOYMENT_ENV.md
- docs/production/PRODUCTION_RUNBOOK.md
- frontend architecture/build docs

Kiểm tra:
- production build
- env configuration
- NEXT_PUBLIC_API_URL hoặc tương đương
- CORS compatibility với Render API
- auth cookie/domain behavior
- HTTPS-only expectations
- error pages
- loading pages
- health/observability where applicable
- source maps/error handling policy

Không hard-code:
- Render URL
- Supabase URL with secret
- R2 credentials
- JWT/session secret

Deployment target có thể là Vercel/Cloudflare Pages hoặc platform nội bộ được user chọn sau này. Không tự mặc định một provider nếu user chưa quyết định.

Tạo:
- docs/frontend/FRONTEND_DEPLOYMENT.md
- docs/frontend/FRONTEND_SMOKE_TEST.md
- docs/frontend/phase-status/PHASE_F11.md

Nếu deploy chưa được yêu cầu:
- chỉ chuẩn bị configuration
- local production build
- không tạo cloud resource
- không push secret

Final:
FRONTEND DEPLOYMENT READY: YES/NO
READY FOR REMOTE FRONTEND DEPLOY: YES/NO
