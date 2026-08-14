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
 * (PcboxService rejects anything else immediately, the first and
 * cheapest of the three checks — see its own comment), so encoding the
 * full ticket-hub-api status vocabulary here would just duplicate a rule
 * that already lives, and is enforced, one call away.
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
