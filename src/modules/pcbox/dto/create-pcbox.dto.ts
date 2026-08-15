import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body of `POST /pcbox`. Field names are camelCase in the JSON
 * body, same convention as ticket-hub-api's DTOs (`CreateTicketDto.codeAnsible`,
 * `CreateUserDto.lastname`, ...) — `class-transformer`/`ValidationPipe`
 * never do any snake_case translation, so the wire shape matches the TS
 * property names 1:1.
 *
 * Field limits mirror the `administrations` table column widths exactly
 * (`department`/`approver`/`informer`/`status` VARCHAR(15), `file_content`
 * VARCHAR(500)) — see documentation/pcbox.pcbox-db-deploy.md.
 *
 * `status` is plain `@IsString()`, not `@IsIn([...])`: the only value this
 * endpoint ever accepts past validation is `'APPROVED'`
 * (`PcboxService.assertApprovedStatus` rejects anything else immediately,
 * before YAML parsing even runs — see its own comment).
 *
 * `department`/`approver`/`informer`/`ticketNumber` are recorded as
 * submitted, ticket metadata kept for the `administrations` record itself —
 * they are no longer checked against ticket-hub-api.
 */
export class CreatePcboxDto {
  @IsInt()
  ticketNumber!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  department!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
  approver!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(15)
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
