import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const CASE_STATUSES = ['OPEN', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'ARCHIVED'] as const;

export class CaseQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CASE_STATUSES)
  status?: (typeof CASE_STATUSES)[number];
}
