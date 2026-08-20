import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PayCommissionTransactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  paymentReference!: string;

  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
