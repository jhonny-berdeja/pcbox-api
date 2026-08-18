import { Module } from '@nestjs/common';
import { JwksClientService } from './jwks-client.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  providers: [JwtAuthGuard, RolesGuard, JwksClientService],
  exports: [JwtAuthGuard, RolesGuard, JwksClientService],
})
export class AuthModule {}
