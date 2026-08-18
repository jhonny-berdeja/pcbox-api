import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrationEntity } from './administration/administration.entity';
import { AdministrationsRepository } from './administration/administrations.repository';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: parseInt(
          configService.get<string>('DATABASE_PORT') ?? '5432',
          10,
        ),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        entities: [AdministrationEntity],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([AdministrationEntity]),
  ],
  providers: [AdministrationsRepository],
  exports: [AdministrationsRepository, TypeOrmModule],
})
export class DatabaseModule {}
