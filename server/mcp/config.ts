export interface Config {
  resource: string; issuer: string; jwks: string; allowedSubjects: string[];
  databaseUrl: string; databaseCa?: string;
}
function httpsUrl(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing ${name}`);
  let url: URL;
  try { url = new URL(value); }
  catch { throw new Error(`Invalid ${name}`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error(`Invalid ${name}`);
  return url.toString();
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resource = httpsUrl(env.MCP_RESOURCE_URL, 'MCP_RESOURCE_URL');
  const issuer = httpsUrl(env.MCP_OAUTH_ISSUER, 'MCP_OAUTH_ISSUER');
  const jwks = httpsUrl(env.MCP_OAUTH_JWKS_URL, 'MCP_OAUTH_JWKS_URL');
  const allowedSubjects = (env.MCP_ALLOWED_SUBJECTS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!allowedSubjects.length) throw new Error('Missing MCP_ALLOWED_SUBJECTS');
  const databaseUrl = env.MCP_DATABASE_URL || '';
  if (!databaseUrl) throw new Error('Missing MCP_DATABASE_URL');
  let db: URL;
  try { db = new URL(databaseUrl); }
  catch { throw new Error('Invalid MCP_DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !/^acs_mcp_login(?:\.[a-z0-9]+)?$/.test(decodeURIComponent(db.username))) throw new Error('Dedicated database login required');
  // pg connection-string SSL options can override verification. Use only our TLS config.
  if ([...db.searchParams.keys()].some(k => k.toLowerCase().startsWith('ssl'))) throw new Error('Remove SSL parameters from database URL');
  return {resource, issuer, jwks, allowedSubjects, databaseUrl, databaseCa: env.MCP_DATABASE_CA?.replace(/\\n/g, '\n')};
}
