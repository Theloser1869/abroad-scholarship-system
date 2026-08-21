# PHASE F02 – API CLIENT + AUTH + RBAC + APP SHELL

Đọc toàn bộ F01 docs trước khi code.

Xây nền tảng frontend:

1. Centralized API client
- base URL env-driven
- credentials/session
- request ID/correlation ID nếu backend có
- consistent error handling
- upload/download handling
- safe retry only for idempotent requests

2. Authentication
- login
- logout
- session bootstrap
- expired session
- 401/403 handling
- secure cookie/session compatible với backend

3. RBAC
- centralized `can(resource, action)` / equivalent
- route guards
- menu/action visibility
- field visibility hints
- backend remains final authority

4. App shell
- sidebar
- topbar
- breadcrumbs
- notification bell/inbox link
- account menu
- responsive navigation
- role-aware navigation

5. Design foundation
- theme tokens
- typography
- spacing
- buttons
- inputs
- cards
- tables
- modal/drawer
- badges
- toasts
- skeletons

6. Initial dashboards/shell placeholders
- no deep business logic yet

Do not create fake endpoints.
Do not store access/refresh token in unsafe browser storage if backend uses secure cookies.

Validation:
- auth tests
- permission tests
- typecheck
- lint
- build

Checkpoint:
docs/frontend/phase-status/PHASE_F02.md
