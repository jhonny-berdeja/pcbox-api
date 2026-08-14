import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

const API_KEY_HEADER = 'x-admin-api-key';
const MISSING_OR_INVALID_KEY_MESSAGE = 'Missing or invalid admin API key';

/**
 * Route-level guard (`@UseGuards(AdminApiKeyGuard)`, applied directly on
 * `POST /pcbox` — no global auth guard exists in this app, so no
 * `@Public()` escape hatch is needed either) protecting the one endpoint
 * that runs real playbooks against the `pcbox` server. Checks the
 * `x-admin-api-key` header against `ADMIN_API_KEY`, a shared secret, never
 * a per-user credential.
 *
 * Mirrors ticket-hub-api's `InternalApiKeyGuard`
 * (`modules/auth/guards/internal-api-key.guard.ts`) almost exactly, but
 * lives under `modules/pcbox/guards/` instead of a shared `auth`
 * module: this app has no `auth` module at all (no user login, no JWT), and
 * this guard is meaningful only for this one module's endpoint today — see
 * `.claude/CLAUDE.md`.
 */
@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.headers[API_KEY_HEADER];
    const expectedKey = this.configService.get<string>('ADMIN_API_KEY');

    if (!providedKey || providedKey !== expectedKey) {
      throw new UnauthorizedException(MISSING_OR_INVALID_KEY_MESSAGE);
    }
    return true;
  }
}
