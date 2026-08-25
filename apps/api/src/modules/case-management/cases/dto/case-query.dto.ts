import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const CASE_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'ARCHIVED'] as const;

export class CaseQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CASE_STATUSES)
  status?: (typeof CASE_STATUSES)[number];

  /// Phase F03 (frontend CRM) fix — Student 360 needs "this student's case(s)" (current +
  /// historical), and there was no way to query that without either loading every Case
  /// globally and filtering client-side (explicitly disallowed) or a new endpoint
  /// duplicating this one. Scope-filtered exactly like every other list query — a caller
  /// without visibility into a given case still won't see it, `studentId` only narrows
  /// further within whatever the caller could already see.
  @IsOptional()
  @IsUUID()
  studentId?: string;

  /// Client Acceptance Remediation GAP-007 — the Contract Closure/Liquidation page needs
  /// "which Case does this Contract belong to" (the rich close() precondition set —
  /// open tasks/debt/visa/enrollment/pre-departure — lives on Case, not Contract). Same
  /// scope-filtered pattern as studentId above.
  @IsOptional()
  @IsUUID()
  contractId?: string;
}
