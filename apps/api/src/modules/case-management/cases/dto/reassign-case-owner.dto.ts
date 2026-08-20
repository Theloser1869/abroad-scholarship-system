import { IsUUID } from 'class-validator';

export class ReassignCaseOwnerDto {
  @IsUUID()
  userId!: string;
}
