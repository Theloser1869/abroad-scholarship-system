# PHASE 14A – PRODUCTION HARDENING

Verify:
- environment configuration
- secrets
- migrations
- backups
- restore
- logging
- monitoring
- alerts
- error handling
- rate limits
- CORS
- CSP
- CSRF
- secure cookies
- session expiry
- storage policy
- queue retry
- idempotency
- retention
- disaster recovery
- CI/CD
- health/readiness/liveness

Create:
docs/production/PRODUCTION_RUNBOOK.md
docs/production/SECURITY_BASELINE.md
docs/production/DISASTER_RECOVERY.md

No debug mode.
No secrets in repository.
No public private bucket.
No unsafe DB reset in production.
