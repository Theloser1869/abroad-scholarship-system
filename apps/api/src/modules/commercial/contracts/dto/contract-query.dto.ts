import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const CONTRACT_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'SENT', 'SIGNED', 'ACTIVE', 'COMPLETED', 'LIQUIDATED', 'ARCHIVED'] as const;

export class ContractQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CONTRACT_STATUSES)
  status?: (typeof CONTRACT_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  studentId?: string;
}
