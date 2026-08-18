import * as jwt from 'jsonwebtoken';
import { TEST_KID, TEST_PRIVATE_KEY } from './test-jwt-keys';

/**
 * Signs an auth-api-shaped ADMIN token directly with the test RSA key
 * -- stands in for ticket-hub-api's apps-user logging into auth-api
 * (`POST /apps-users/login`, `X-Application-Name: pcbox-api`), which
 * this app never calls itself.
 */
export function signAdminToken(): string {
  const payload = {
    sub: 1,
    apps: {
      application: {
        id: 1,
        name: 'pcbox-api',
        description: 'Pcbox API',
        roles: [{ id: 1, name: 'ADMIN', description: 'ADMIN' }],
      },
    },
  };

  return jwt.sign(payload, TEST_PRIVATE_KEY, {
    algorithm: 'RS256',
    keyid: TEST_KID,
    expiresIn: '1h',
  });
}
