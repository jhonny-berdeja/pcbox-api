import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DatabaseActionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  namespace!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  deployment!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  dbName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  sqlCode!: string;
}
