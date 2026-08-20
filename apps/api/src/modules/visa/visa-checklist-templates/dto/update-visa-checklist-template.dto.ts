import { PartialType } from '@nestjs/mapped-types';
import { CreateVisaChecklistTemplateDto } from './create-visa-checklist-template.dto';

export class UpdateVisaChecklistTemplateDto extends PartialType(CreateVisaChecklistTemplateDto) {}
