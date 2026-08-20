import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicRecordDto } from './create-academic-record.dto';

export class UpdateAcademicRecordDto extends PartialType(CreateAcademicRecordDto) {}
