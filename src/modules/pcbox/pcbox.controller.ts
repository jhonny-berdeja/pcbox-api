import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxService } from './pcbox.service';
import { PcboxResponse } from './pcbox-response';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

/**
 * Every route here needs the shared-secret guard — there's no user JWT in
 * this app to fall back to, and no other role that should ever reach this
 * endpoint, so `AdminApiKeyGuard` goes at the class level instead of
 * repeated per-route (unlike ticket-hub-api's `InternalApiKeyGuard`, which
 * is deliberately route-level because most of TicketsController's routes
 * use JWT instead).
 */
@Controller('pcbox')
@UseGuards(AdminApiKeyGuard)
export class PcboxController {
  constructor(private readonly pcboxService: PcboxService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePcboxDto): Promise<ResponseBody<PcboxResponse>> {
    return this.pcboxService.create(dto);
  }
}
