import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateCommissionRuleDto } from './create-commission-rule.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class UpdateCommissionRuleDto extends PartialType(CreateCommissionRuleDto) {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
