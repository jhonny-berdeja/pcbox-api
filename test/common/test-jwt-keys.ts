import { generateKeyPairSync } from 'crypto';

/**
 * One RSA key pair, generated once per test process -- stands in for
 * auth-api's real key pair. `TEST_KID` must match the `kid` used both
 * when signing a test token (`sign-admin-token.ts`) and in the stubbed
 * `JwksClientService` (`jwks-client-service.stub.ts`). Mirrors
 * ticket-hub-api's own `test/common/test-jwt-keys.ts` exactly.
 */
export const TEST_KID = 'test-rsa-1';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

export const TEST_PRIVATE_KEY = privateKey;
export const TEST_PUBLIC_KEY = publicKey;
