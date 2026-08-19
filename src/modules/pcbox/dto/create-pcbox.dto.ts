import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { TicketType } from '../value-objects/ticket-type.enum';
import { DatabaseActionDto } from './database-action.dto';

const TICKET_TYPES = Object.values(TicketType);

export class CreatePcboxDto {
  @IsInt()
  ticketNumber!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  approver!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  informer!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  status!: string;

  /** Optional for rollout: omitted requests are treated as ANSIBLE (see PcboxMapper). */
  @IsOptional()
  @IsIn(TICKET_TYPES)
  ticketType?: TicketType;

  @ValidateIf((dto: CreatePcboxDto) => dto.ticketType !== TicketType.DATABASE)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileContent?: string;

  @ValidateIf((dto: CreatePcboxDto) => dto.ticketType === TicketType.DATABASE)
  @ValidateNested()
  @Type(() => DatabaseActionDto)
  database?: DatabaseActionDto;
}
