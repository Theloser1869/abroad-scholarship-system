import { IsIn, IsUUID } from 'class-validator';

export class AddCaseMemberDto {
  @IsUUID()
  userId!: string;

  @IsIn(['OWNER', 'COLLABORATOR'])
  role!: 'OWNER' | 'COLLABORATOR';
}
