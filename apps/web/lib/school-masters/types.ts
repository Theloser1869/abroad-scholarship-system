import type { MasterDataStatus } from "../universities/types";

/// Client Acceptance Remediation DEC-05(b) (2026-08-27) — mirrors `database/schema.prisma`
/// `SchoolMaster`. Deliberately minimal — no business-code ID (not a client-mandated
/// sheet18/20 format).

export interface SchoolMaster {
  id: string;
  name: string;
  status: MasterDataStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSchoolMasterInput {
  name: string;
}
