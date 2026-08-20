import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class UniversityQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
