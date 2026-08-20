import { PartialType } from '@nestjs/mapped-types';
import { CreateResearchProjectDto } from './create-research-project.dto';

export class UpdateResearchProjectDto extends PartialType(CreateResearchProjectDto) {}
