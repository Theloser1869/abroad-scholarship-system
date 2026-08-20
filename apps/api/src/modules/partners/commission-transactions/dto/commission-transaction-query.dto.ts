import { CommissionTransactionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../../common/dto/list-query.dto';

export class CommissionTransactionQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(CommissionTransactionStatus)
  status?: CommissionTransactionStatus;

  @IsOptional()
  @IsUUID()
  partnerId?: string;
}
