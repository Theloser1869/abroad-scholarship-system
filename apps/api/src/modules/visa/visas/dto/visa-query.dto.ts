import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['NOT_STARTED', 'PREPARING', 'READY', 'SUBMITTED', 'APPOINTMENT', 'INTERVIEW', 'GRANTED', 'REFUSED', 'WITHDRAWN'] as const;

export class VisaQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
