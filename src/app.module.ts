import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EnvModule } from './common/config/env.module';
import { DatabaseModule } from './common/database/database.module';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { UnknownExceptionFilter } from './common/filters/unknown-exception.filter';
import { LoggerModule } from './instrument/logger/logger.module';
import { PcboxModule } from './modules/pcbox/pcbox.module';

@Module({
  imports: [EnvModule, LoggerModule, DatabaseModule, PcboxModule],
  providers: [
    { provide: APP_FILTER, useClass: UnknownExceptionFilter },
    { provide: APP_FILTER, useClass: DatabaseExceptionFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
