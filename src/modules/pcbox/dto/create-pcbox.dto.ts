import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileContent!: string;
}
