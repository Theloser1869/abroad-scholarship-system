import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class PartnerProgramQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsUUID()
  programId?: string;
}
