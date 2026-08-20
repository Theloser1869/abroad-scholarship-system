import { CommissionBasis } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class CommissionRuleQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  partnerProgramId?: string;

  @IsOptional()
  @IsEnum(CommissionBasis)
  basis?: CommissionBasis;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
