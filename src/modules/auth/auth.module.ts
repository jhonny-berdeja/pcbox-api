import { Module } from '@nestjs/common';
import { JwksClientService } from './jwks-client.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

/**
 * No controller of its own -- this app never issues tokens, only
 * verifies them (auth-api does the issuing). `PcboxModule` imports this
 * one to apply `JwtAuthGuard`/`RolesGuard` on `PcboxController`.
 */
@Module({
  providers: [JwtAuthGuard, RolesGuard, JwksClientService],
  exports: [JwtAuthGuard, RolesGuard, JwksClientService],
})
export class AuthModule {}
