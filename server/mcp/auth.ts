import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Config } from './config.js';
export const SCOPE = 'acs:read';
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authorize(header: string | undefined, config: Config, testKey?: JWTVerifyGetKey) {
  const match = header?.match(/^Bearer ([^\s]+)$/i);
  if (!match) throw new Error('Unauthorized');
  let key = testKey || keySets.get(config.jwks);
  if (!key) {
    key = createRemoteJWKSet(new URL(config.jwks), {timeoutDuration: 5000, cooldownDuration: 30000});
    keySets.set(config.jwks, key as ReturnType<typeof createRemoteJWKSet>);
  }
  const {payload} = await jwtVerify(match[1], key, {
    issuer: config.issuer, audience: config.resource, algorithms: ['RS256'],
    requiredClaims: ['exp', 'iat', 'sub'], clockTolerance: 5,
  });
  if (!payload.sub || !config.allowedSubjects.includes(payload.sub)) throw new Error('Unauthorized');
  if (typeof payload.scope !== 'string' || !payload.scope.split(' ').includes(SCOPE)) throw new Error('Unauthorized');
  return payload.sub;
}
export function protectedResource(config: Pick<Config, 'resource' | 'issuer'>) {
  return {resource: config.resource, authorization_servers: [config.issuer], scopes_supported: [SCOPE], bearer_methods_supported: ['header'], resource_name: 'UnifiedACS read-only'};
}
export function challenge(config: Pick<Config, 'resource'>) {
  const metadata = new URL('/.well-known/oauth-protected-resource', config.resource);
  return `Bearer resource_metadata="${metadata}", scope="${SCOPE}"`;
}
