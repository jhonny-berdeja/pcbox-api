import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminApiKeyGuard } from './admin-api-key.guard';

function buildContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminApiKeyGuard', () => {
  it('allows the request when the header matches ADMIN_API_KEY', () => {
    const configService = {
      get: () => 'the-real-secret',
    } as unknown as ConfigService;
    const guard = new AdminApiKeyGuard(configService);

    const result = guard.canActivate(
      buildContext({ 'x-admin-api-key': 'the-real-secret' }),
    );

    expect(result).toBe(true);
  });

  it('rejects a missing header', () => {
    const configService = {
      get: () => 'the-real-secret',
    } as unknown as ConfigService;
    const guard = new AdminApiKeyGuard(configService);

    expect(() => guard.canActivate(buildContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a wrong key, even a non-empty one', () => {
    const configService = {
      get: () => 'the-real-secret',
    } as unknown as ConfigService;
    const guard = new AdminApiKeyGuard(configService);

    expect(() =>
      guard.canActivate(buildContext({ 'x-admin-api-key': 'a-guessed-value' })),
    ).toThrow(UnauthorizedException);
  });
});
