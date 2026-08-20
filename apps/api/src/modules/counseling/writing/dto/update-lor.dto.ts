import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CreateLorDto } from './create-lor.dto';

const REQUEST_STATUSES = ['NOT_REQUESTED', 'REQUESTED', 'IN_PROGRESS', 'RECEIVED', 'DECLINED'] as const;
const SUBMISSION_STATUSES = ['PENDING', 'SUBMITTED', 'NOT_REQUIRED'] as const;

export class UpdateLorDto extends PartialType(CreateLorDto) {
  @IsOptional()
  @IsIn(REQUEST_STATUSES)
  requestStatus?: (typeof REQUEST_STATUSES)[number];

  @IsOptional()
  @IsIn(SUBMISSION_STATUSES)
  submissionStatus?: (typeof SUBMISSION_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  evidenceDocumentId?: string;
}
