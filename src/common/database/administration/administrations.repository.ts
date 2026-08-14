import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrationEntity } from './administration.entity';

@Injectable()
export class AdministrationsRepository {
  constructor(
    @InjectRepository(AdministrationEntity)
    private readonly repository: Repository<AdministrationEntity>,
  ) {}

  createAdministration(
    administration: AdministrationEntity,
  ): Promise<AdministrationEntity> {
    const entity = this.repository.create(administration);
    return this.repository.save(entity);
  }
}
