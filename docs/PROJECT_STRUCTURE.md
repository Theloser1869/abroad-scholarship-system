# PROJECT STRUCTURE

## Recommended logical architecture

```text
project/
├─ apps/
│  ├─ web/
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ features/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  └─ styles/
│  │
│  └─ api/
│     ├─ modules/
│     │  ├─ identity/
│     │  ├─ crm/
│     │  ├─ case-management/
│     │  ├─ counseling/
│     │  ├─ profile/
│     │  ├─ admission/
│     │  ├─ visa/
│     │  ├─ commercial/
│     │  ├─ partners/
│     │  ├─ documents/
│     │  ├─ notifications/
│     │  └─ reporting/
│     ├─ common/
│     └─ main
│
├─ packages/
│  ├─ ui/
│  ├─ auth/
│  ├─ config/
│  ├─ types/
│  └─ domain/
│
├─ database/
│  ├─ migrations/
│  ├─ seeds/
│  └─ fixtures/
│
├─ workers/
│  ├─ notifications/
│  ├─ documents/
│  ├─ exports/
│  └─ integrations/
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  ├─ security/
│  └─ fixtures/
│
├─ docs/
│  ├─ architecture/
│  ├─ database/
│  ├─ api/
│  ├─ security/
│  ├─ production/
│  └─ phase-status/
│
└─ scripts/
```

Adapt to the existing repository rather than forcing an identical folder layout.
