import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadConfig } from '../server/mcp/config.js';
import { protectedResource } from '../server/mcp/auth.js';
export default function handler(req: IncomingMessage, res: ServerResponse) {
 res.setHeader('Cache-Control', 'no-store');
 if (req.method !== 'GET') {res.statusCode = 405; res.setHeader('Allow','GET'); res.end(); return;}
 try {
   const metadata = protectedResource(loadConfig());
   res.setHeader('Content-Type','application/json');
   res.end(JSON.stringify(metadata));
 } catch {res.statusCode = 503; res.end('Connector is not configured');}
}
