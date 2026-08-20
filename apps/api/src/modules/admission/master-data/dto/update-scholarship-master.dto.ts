import { PartialType } from '@nestjs/mapped-types';
import { CreateScholarshipMasterDto } from './create-scholarship-master.dto';

export class UpdateScholarshipMasterDto extends PartialType(CreateScholarshipMasterDto) {}
