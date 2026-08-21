import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseRegisterEntity } from './database-register.entity';

@Injectable()
export class DatabaseRegisterRepository {
  constructor(
    @InjectRepository(DatabaseRegisterEntity)
    private readonly repository: Repository<DatabaseRegisterEntity>,
  ) {}

  createAdministration(
    administration: DatabaseRegisterEntity,
  ): Promise<DatabaseRegisterEntity> {
    const entity = this.repository.create(administration);
    return this.repository.save(entity);
  }
}
