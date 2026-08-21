import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatacenterRegisterEntity } from './datacenter-register.entity';

@Injectable()
export class DatacenterRegisterRepository {
  constructor(
    @InjectRepository(DatacenterRegisterEntity)
    private readonly repository: Repository<DatacenterRegisterEntity>,
  ) {}

  createAdministration(
    administration: DatacenterRegisterEntity,
  ): Promise<DatacenterRegisterEntity> {
    const entity = this.repository.create(administration);
    return this.repository.save(entity);
  }
}
