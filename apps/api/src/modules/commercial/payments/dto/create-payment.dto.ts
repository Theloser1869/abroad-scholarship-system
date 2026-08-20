import { IsDateString, IsISO4217CurrencyCode, IsInt, IsNumber, Min } from 'class-validator';

/// Creates a payment-schedule entry (an installment), not a recorded transaction —
/// recording money received is `POST /payments/:id/record`.
export class CreatePaymentDto {
  @IsInt()
  @Min(1)
  installmentNo!: number;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsDateString()
  dueDate!: string;
}
