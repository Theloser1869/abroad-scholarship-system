import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

export class AuditLogQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  objectType?: string;

  @IsOptional()
  @IsString()
  objectId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  caseId?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
