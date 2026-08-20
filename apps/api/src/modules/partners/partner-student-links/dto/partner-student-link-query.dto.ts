import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'ARCHIVED'] as const;

export class PartnerStudentLinkQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
