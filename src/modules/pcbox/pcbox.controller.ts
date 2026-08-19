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
import { PcboxResponse } from './dto/pcbox-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Role } from '../auth/value-objects/role.enum';

@Controller('pcbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PcboxController {
  constructor(private readonly pcboxService: PcboxService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  executeAdministrationPlaybook(@Body() dto: CreatePcboxDto): Promise<ResponseBody<PcboxResponse>> {
    return this.pcboxService.executeAdministrationPlaybook(dto);
  }
}
