import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/// Centralized business-ID generator (SRS section 8). One place every module calls
/// instead of each module inventing its own counter — the exact migration risk flagged in
/// docs/REPOSITORY_AUDIT.md section 8 ("Rủi ro ID format không nhất quán").
///
/// IDs are immutable once assigned (SRS section 8 "ID không thay đổi trong vòng đời bản
/// ghi") and never reused after archive — this service only ever increments, never
/// reclaims a freed number.
@Injectable()
export class IdGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /// `PREFIX-YYYY-NNNNN` — used by Student (HS), Contract (HD), Case (CASE), Lead (LEAD),
  /// Task (TASK), Document (DOC), Payment (PAY), Contract Amendment (AM), Application (APP),
  /// Scholarship Application (SCH), Visa (VISA) per SRS section 8.
  async nextYearlyCode(prefix: string, digits = 5, year: number = new Date().getFullYear()): Promise<string> {
    const bucket = String(year);
    const seq = await this.nextSequenceValue(prefix, bucket);
    return `${prefix}-${bucket}-${String(seq).padStart(digits, '0')}`;
  }

  /// `PREFIX-CC-NNNNN` — used by Partner (PT) per SRS section 8. `countryCode` must be
  /// ISO 3166-1 alpha-2 (SRS section 8 "Country code phải dùng chuẩn ISO 3166-1 alpha-2"),
  /// validated by the caller's DTO, not re-validated here.
  async nextCountryScopedCode(prefix: string, countryCode: string, digits = 5): Promise<string> {
    const bucket = countryCode.toUpperCase();
    const seq = await this.nextSequenceValue(prefix, bucket);
    return `${prefix}-${bucket}-${String(seq).padStart(digits, '0')}`;
  }

  /// `PP-CC-NNNNN-NN` — Partner Program (SRS section 8): parent Partner code (`PT-CC-NNNNN`)
  /// supplies the `CC-NNNNN` segment, this only generates the `-NN` sub-sequence scoped to
  /// that partner. Client Acceptance Remediation (REQ-ID-004/REQ-PARTNER-005, 2026-08-27) —
  /// the output must carry the `PP` prefix, not the parent's own `PT` prefix; the sequence
  /// bucket key stays the full `partnerCode` (unchanged scoping/uniqueness behavior), only
  /// the returned string's prefix segment is substituted.
  async nextPartnerProgramSuffix(partnerCode: string, digits = 2): Promise<string> {
    const seq = await this.nextSequenceValue('PP_SUFFIX', partnerCode);
    const programPrefix = partnerCode.replace(/^PT-/, 'PP-');
    return `${programPrefix}-${String(seq).padStart(digits, '0')}`;
  }

  private async nextSequenceValue(prefix: string, bucket: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE via a raw statement: Prisma's upsert alone is not
      // guaranteed atomic-increment under concurrent transactions on all isolation
      // levels, so the row is locked explicitly before incrementing.
      await tx.$executeRawUnsafe(
        `INSERT INTO business_id_sequences (prefix, bucket, last_value, updated_at)
         VALUES ($1, $2, 0, now())
         ON CONFLICT (prefix, bucket) DO NOTHING`,
        prefix,
        bucket,
      );
      const rows = await tx.$queryRawUnsafe<{ last_value: number }[]>(
        `SELECT last_value FROM business_id_sequences WHERE prefix = $1 AND bucket = $2 FOR UPDATE`,
        prefix,
        bucket,
      );
      const next = (rows[0]?.last_value ?? 0) + 1;
      await tx.$executeRawUnsafe(
        `UPDATE business_id_sequences SET last_value = $1, updated_at = now() WHERE prefix = $2 AND bucket = $3`,
        next,
        prefix,
        bucket,
      );
      return next;
    });
  }
}
