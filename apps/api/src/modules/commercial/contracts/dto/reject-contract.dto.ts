import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectContractDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
