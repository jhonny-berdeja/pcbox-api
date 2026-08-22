import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatacenterRegisterEntity } from './administration/datacenter-register.entity';
import { DatabaseRegisterEntity } from './administration/database-register.entity';
import { KubernetesRegisterEntity } from './administration/kubernetes-register.entity';
import { DatacenterRegisterRepository } from './administration/datacenter-register.repository';
import { DatabaseRegisterRepository } from './administration/database-register.repository';
import { KubernetesRegisterRepository } from './administration/kubernetes-register.repository';

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
        entities: [
          DatacenterRegisterEntity,
          DatabaseRegisterEntity,
          KubernetesRegisterEntity,
        ],
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([
      DatacenterRegisterEntity,
      DatabaseRegisterEntity,
      KubernetesRegisterEntity,
    ]),
  ],
  providers: [
    DatacenterRegisterRepository,
    DatabaseRegisterRepository,
    KubernetesRegisterRepository,
  ],
  exports: [
    DatacenterRegisterRepository,
    DatabaseRegisterRepository,
    KubernetesRegisterRepository,
    TypeOrmModule,
  ],
})
export class DatabaseModule {}
