import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';
import { DatabaseService } from './database.service';
import { DatabaseResponse } from './dto/database-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Role } from '../auth/value-objects/role.enum';
import { DB_TARGETS, DbTarget } from './value-objects/db-target.allowlist';

@Controller('database')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  executeAdministrationPlaybook(
    @Body() dto: CreateDatabaseAdministrationDto,
  ): Promise<ResponseBody<DatabaseResponse>> {
    return this.databaseService.executeAdministrationPlaybook(dto);
  }

  /** Single source of truth for the allowlisted DATABASE targets — ticket-hub-api proxies this at `GET /tickets/db-targets`. */
  @Get('db-targets')
  getDbTargets(): ResponseBody<readonly DbTarget[]> {
    return ResponseBody.builder<readonly DbTarget[]>()
      .withMsg('Allowlisted database targets retrieved successfully')
      .withData(DB_TARGETS)
      .build();
  }
}
