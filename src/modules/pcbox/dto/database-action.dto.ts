import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OperationType } from '../value-objects/operation-type.enum';

const OPERATION_TYPES = Object.values(OperationType);

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

  @IsIn(OPERATION_TYPES)
  operationType!: OperationType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  sqlCode!: string;
}
