import { IsISO4217CurrencyCode, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

/// "Không tạo Student hoặc Case mới chỉ vì tạo Contract" — `studentId` must reference an
/// existing Student; this DTO has no way to create one. Case linkage happens later, at
/// signing (`ContractsService.sign`), not here — see docs/ASSUMPTIONS.md ASM-15.
export class CreateContractDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  servicePackage?: string;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsISO4217CurrencyCode()
  currency!: string;

  @IsOptional()
  @IsObject()
  mergeFieldValues?: Record<string, unknown>;
}
