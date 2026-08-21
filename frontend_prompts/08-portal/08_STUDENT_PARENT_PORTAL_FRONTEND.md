# PHASE F08 – STUDENT / PARENT PORTAL

Xây experience riêng cho Student/Parent, không dùng nguyên staff shell.

STUDENT
- home/dashboard
- profile
- roadmap
- tasks
- documents
- applications
- scholarships
- visa
- pre-departure
- enrollment
- contract/payment view
- notifications

PARENT
- invitation/acceptance flow nếu UI được yêu cầu
- linked student selector
- child summary
- same scope restrictions as backend
- revoked relationship handling

Security UX:
- own student only
- linked children only
- hide internal notes
- hide commission
- hide staff KPI
- hide internal strategy
- backend remains authority

Responsive:
- mobile-first
- touch-friendly
- accessible navigation

Do not expose arbitrary document IDs or direct storage URLs.
Do not let portal mutate staff-only workflow states.

Validation:
- Student journey
- Parent journey
- revoked parent
- IDOR through direct API tests where possible
- build/typecheck/lint

Checkpoint PHASE_F08.
