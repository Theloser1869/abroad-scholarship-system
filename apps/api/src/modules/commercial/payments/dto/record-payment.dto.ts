import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/// 05-commercial rules #1–#6. `reference` is checked for duplicates (both a friendly
/// service-level check and a DB-level `@unique` backstop on `Payment.reference`).
/// `allowOverpayment` is the explicit, deliberate override rule #6 requires ("Không được
/// làm âm balance do overpayment mà không có rule rõ ràng") — omitting it means an
/// over-the-amount payment is rejected, not silently accepted.
export class RecordPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @IsOptional()
  @IsBoolean()
  allowOverpayment?: boolean;
}
