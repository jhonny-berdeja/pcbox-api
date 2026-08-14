import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './env.validation';

/**
 * Wraps Nest's `ConfigModule` so env validation lives with the rest of the
 * `common/` infrastructure — same pattern as `DatabaseModule`. `ignoreEnvFile`
 * is intentional: the app runs cluster-only, values always come from the
 * container environment (Deployment/Secret), never a `.env` file.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate,
    }),
  ],
  exports: [ConfigModule],
})
export class EnvModule {}
