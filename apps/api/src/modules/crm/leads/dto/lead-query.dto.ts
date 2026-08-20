import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONSULTATION', 'CONTRACTING', 'CONVERTED', 'LOST'] as const;

export class LeadQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(LEAD_STATUSES)
  status?: (typeof LEAD_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
