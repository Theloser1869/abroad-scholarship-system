import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['PLANNING', 'PREPARING', 'READY_FOR_REVIEW', 'SUBMITTED', 'OFFER', 'WAITLIST', 'REJECT', 'WITHDRAWN'] as const;

export class ApplicationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
