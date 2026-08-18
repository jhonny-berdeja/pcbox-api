/**
 * Only ADMIN is checked today -- this app has exactly one guarded
 * route (POST /pcbox), and the only caller is ticket-hub-api's own
 * apps-user, assigned ADMIN on the "pcbox-api" application in auth-api.
 * Values are exact strings compared against `RolePayload.name` on the
 * auth-api-issued token (see RolesGuard).
 */
export enum Role {
  ADMIN = 'ADMIN',
}
