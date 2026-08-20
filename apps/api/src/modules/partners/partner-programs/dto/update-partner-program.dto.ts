import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreatePartnerProgramDto } from './create-partner-program.dto';

const STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export class UpdatePartnerProgramDto extends PartialType(CreatePartnerProgramDto) {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
