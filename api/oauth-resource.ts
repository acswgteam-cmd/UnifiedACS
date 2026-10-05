import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../server/mcp/config.js';
import { protectedResource } from '../server/mcp/auth.js';

// Fixed messages only: never expose environment values or native URL errors.
export function safeConfigDiagnostic(error: unknown): string {
 const message = error instanceof Error ? error.message : '';
 if (/^(Missing|Invalid) MCP_(RESOURCE_URL|OAUTH_ISSUER|OAUTH_JWKS_URL|ALLOWED_SUBJECTS|DATABASE_URL)$/.test(message)) return message;
 if (message === 'Dedicated database login required') return 'MCP_DATABASE_URL: username must be acs_mcp_login or acs_mcp_login.PROJECTREF';
 if (message === 'Remove SSL parameters from database URL') return 'MCP_DATABASE_URL: remove ssl parameters; the server configures TLS';
 return 'Configuration validation failed; values are hidden';
}
export default function handler(req: IncomingMessage, res: ServerResponse) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'GET') {res.statusCode = 405; res.setHeader('Allow','GET'); res.end(); return;}
 try {
   const metadata = protectedResource(loadConfig());
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify(metadata));
 } catch (error) {
   res.statusCode = 503;
   res.setHeader('Content-Type', 'text/plain; charset=utf-8');
   res.end('Connector is not configured\n' + safeConfigDiagnostic(error));
 }
}
