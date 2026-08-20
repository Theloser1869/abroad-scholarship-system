import { PartnerDocumentStatus, PartnerDocumentType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

export class PartnerDocumentQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(PartnerDocumentType)
  type?: PartnerDocumentType;

  @IsOptional()
  @IsEnum(PartnerDocumentStatus)
  status?: PartnerDocumentStatus;
}
