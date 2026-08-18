/**
 * Decoded shape of a token issued by auth-api -- what `JwtAuthGuard`
 * verifies and attaches to `request.user`, and what `RolesGuard` reads
 * roles from. Mirrors auth-api's own `AuthenticatedUser`/`AppsPayload`
 * exactly (see `auth-api/src/common/jwt/apps-payload.ts`). The caller
 * here is always ticket-hub-api's apps-user (`clienteId`/`clienteSecret`
 * login, not a human), but the token shape is identical either way.
 */
export interface RolePayload {
  id: number;
  name: string;
  description: string;
}

export interface ApplicationPayload {
  id: number;
  name: string;
  description: string;
  roles: RolePayload[];
}

export interface AuthenticatedUser {
  sub: number;
  apps: {
    application: ApplicationPayload;
  };
}
