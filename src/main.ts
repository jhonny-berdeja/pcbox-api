import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // `bufferLogs: true` holds Nest's own bootstrap log calls (module init,
  // route mapping) until `useLogger()` below swaps in `nestjs-pino`'s
  // `Logger`, so those framework messages come out as JSON too instead of
  // being lost or printed by the default plain-text logger first.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
