import { config } from 'dotenv';
import { resolve } from 'node:path';

// Integration tests run the real Nest app against the real docker-compose Postgres
// container — load the same .env the app itself would load in dev (repo root, not
// apps/api), before any test file references process.env.
config({ path: resolve(__dirname, '../../../.env') });
