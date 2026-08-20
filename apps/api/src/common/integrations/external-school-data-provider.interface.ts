import { Injectable } from '@nestjs/common';

/// Phase 12 adapter (12-platform/02_INTEGRATIONS_JOBS.md "adapters: external school data" +
/// "External data: source, URL, retrieved_at, last_verified_at, sync status, external ID").
/// Unlike the other Phase 12 adapters, this ONE has a real call site — the
/// `EXTERNAL_DATA_SYNC` job processor (`ExternalSyncModule`) — since University/Program/
/// ScholarshipMaster already carry the sync-target columns (Phase 08 `source`/
/// `lastVerifiedAt`, Phase 12 `sourceUrl`/`externalId`/`retrievedAt`/`syncStatus`). The
/// default (`NoopExternalSchoolDataProvider`) returns no records — this project has no
/// real external university/scholarship data source or credentials — so in practice the
/// sync job is a no-op today, but the "don't silently overwrite manually verified data"
/// conflict-avoidance logic downstream of this interface is real and independently
/// tested (a fake provider is substituted in tests). See `docs/ASSUMPTIONS.md` ASM-51.
export const EXTERNAL_SCHOOL_DATA_PROVIDER = Symbol('EXTERNAL_SCHOOL_DATA_PROVIDER');

export interface ExternalUniversityRecord {
  externalId: string;
  sourceUrl: string;
  officialName?: string;
  website?: string;
  admissionsUrl?: string;
}

export interface ExternalSchoolDataProvider {
  /// Returns whatever external University records are available to sync. Matched against
  /// existing rows by `externalId` (never by name — "Không duplicate University").
  fetchUniversities(): Promise<ExternalUniversityRecord[]>;
}

@Injectable()
export class NoopExternalSchoolDataProvider implements ExternalSchoolDataProvider {
  async fetchUniversities(): Promise<ExternalUniversityRecord[]> {
    return [];
  }
}
