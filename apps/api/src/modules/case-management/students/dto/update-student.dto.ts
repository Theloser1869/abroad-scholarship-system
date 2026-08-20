import { PartialType } from '@nestjs/mapped-types';
import { CreateStudentDto } from './create-student.dto';

/// PATCH semantics: every field optional, no field is required to be re-sent.
export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
