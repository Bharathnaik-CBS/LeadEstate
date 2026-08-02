import { IsString } from 'class-validator';

export class AssignLeadDto {
  @IsString()
  assignedToId: string;
}
