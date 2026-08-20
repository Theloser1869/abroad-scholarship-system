import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

export class ShareDocumentDto {
  @IsUUID()
  principalId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['VIEW', 'DOWNLOAD'], { each: true })
  permissions!: ('VIEW' | 'DOWNLOAD')[];
}
