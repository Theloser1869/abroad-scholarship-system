# PHASE 03A – AUTHENTICATION

Implement:
- login
- logout
- password reset
- session/refresh
- revoke session
- account suspension
- internal MFA
- login attempt tracking
- brute-force protection

Rules:
- secure password hashing
- secure cookies/token handling
- no secret logging
- no verbose auth errors
- session expiry configurable

Tests:
- valid login
- invalid login
- locked account
- expired session
- revoked session
- MFA allow/deny
- reset token replay prevention
