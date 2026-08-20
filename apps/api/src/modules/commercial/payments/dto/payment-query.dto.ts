import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const PAYMENT_STATUSES = ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'REFUNDED', 'WAIVED'] as const;

export class PaymentQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];

  /// Filters to payments that are overdue *right now* (computed — see
  /// `PaymentsService.isOverdue` — "Overdue phải được xác định nhất quán": one function,
  /// used for both this filter and the `isOverdue` field on every response). A plain
  /// `@Type(() => Boolean)` would silently turn a literal `?overdue=false` into `true`
  /// (class-transformer's implicit Boolean conversion is just `Boolean(value)`, and any
  /// non-empty string — including the string "false" — is truthy) — this maps the two
  /// actual query-string values explicitly instead.
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  overdue?: boolean;
}
