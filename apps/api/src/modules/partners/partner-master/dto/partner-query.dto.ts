import { IsIn, IsISO31661Alpha2, IsOptional } from 'class-validator';
import { PartnerType } from '@prisma/client';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class PartnerQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(Object.values(PartnerType))
  type?: PartnerType;

  @IsOptional()
  @IsISO31661Alpha2()
  countryCode?: string;

  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
