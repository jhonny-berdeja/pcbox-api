import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { KubernetesService } from './kubernetes.service';
import { KubernetesResponse } from './dto/kubernetes-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { Role } from '../auth/value-objects/role.enum';

@Controller('kubernetes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class KubernetesController {
  constructor(private readonly kubernetesService: KubernetesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  execute(
    @Body() dto: CreateKubernetesDto,
  ): Promise<ResponseBody<KubernetesResponse>> {
    return this.kubernetesService.executeManifests(dto);
  }

  /**
   * `fileContent` is an Ansible playbook here, not a k8s manifest — same
   * body shape as `POST /kubernetes`, executed through
   * `KubernetesService.executeAnsiblePlaybook` (Ansible/SSH) instead of
   * `executeManifests` (k8s API).
   */
  @Post('ansible')
  @HttpCode(HttpStatus.CREATED)
  executeAnsible(
    @Body() dto: CreateKubernetesDto,
  ): Promise<ResponseBody<KubernetesResponse>> {
    return this.kubernetesService.executeAnsiblePlaybook(dto);
  }
}
