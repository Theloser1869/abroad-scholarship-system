import { IsNumber, IsOptional, IsString, Min, MaxLength, MinLength } from 'class-validator';

export class RefundPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;
}
