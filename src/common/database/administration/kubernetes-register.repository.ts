import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KubernetesRegisterEntity } from './kubernetes-register.entity';

@Injectable()
export class KubernetesRegisterRepository {
  constructor(
    @InjectRepository(KubernetesRegisterEntity)
    private readonly repository: Repository<KubernetesRegisterEntity>,
  ) {}

  createExecution(
    execution: KubernetesRegisterEntity,
  ): Promise<KubernetesRegisterEntity> {
    const entity = this.repository.create(execution);
    return this.repository.save(entity);
  }
}
