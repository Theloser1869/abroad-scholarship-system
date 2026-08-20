import { Injectable } from '@nestjs/common';

/// Phase 12 adapter (12-platform/02_INTEGRATIONS_JOBS.md "adapters: payment/accounting").
/// This is an EXTERNAL bookkeeping-system sync boundary — deliberately separate from and
/// never touching this project's own `Payment`/`Contract` source of truth (Phase 05
/// remains authoritative for money; see `docs/ASSUMPTIONS.md` ASM-13). No Phase 01-12 MD
/// names a concrete external accounting system to sync to. Interface + no-op default only,
/// same scope reasoning as `ESignProvider`. See `docs/ASSUMPTIONS.md` ASM-54.
export const ACCOUNTING_PROVIDER = Symbol('ACCOUNTING_PROVIDER');

export interface AccountingEntryRequest {
  paymentId: string;
  amount: string;
  currency: string;
}

export interface AccountingProvider {
  recordEntry(request: AccountingEntryRequest): Promise<void>;
}

@Injectable()
export class NoopAccountingProvider implements AccountingProvider {
  async recordEntry(request: AccountingEntryRequest): Promise<void> {
    void request;
  }
}
