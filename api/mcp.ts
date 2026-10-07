import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig, type Config } from '../server/mcp/config.js';
import { authorize, challenge } from '../server/mcp/auth.js';
import { withReadDatabase, withWriteDatabase, type Query } from '../server/mcp/database.js';
import { CREATE_SCOPE } from '../server/mcp/artwork.js';
import { createServer } from '../server/mcp/tools.js';

type Request = IncomingMessage & {body?: unknown};
export function makeHandler(deps: {
 config?: () => Config;
 auth?: typeof authorize;
 write?: <T>(config: Config, run: (query: Query) => Promise<T>) => Promise<T>;
 read?: <T>(config: Config, run: (query: Query) => Promise<T>) => Promise<T>;
} = {}) {
 return async (req: Request, res: ServerResponse) => {
  res.setHeader('Cache-Control', 'no-store');
  let config: Config;
  try {config = (deps.config || loadConfig)();}
  catch {res.statusCode = 503; res.end('Connector is not configured'); return;}
  const origin = req.headers.origin;
  if (origin && !['https://chatgpt.com', new URL(config.resource).origin].includes(origin)) {
    res.statusCode = 403; res.end('Origin not allowed'); return;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate, MCP-Protocol-Version');
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');
    res.statusCode = 204; res.end(); return;
  }
  let subject: string;
  try {subject = await (deps.auth || authorize)(req.headers.authorization, config);}
  catch {res.setHeader('WWW-Authenticate', challenge(config)); res.statusCode = 401; res.end('Unauthorized'); return;}
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS'); res.statusCode = 405; res.end('Stateless endpoint accepts POST'); return;
  }
  if (Number(req.headers['content-length'] || 0) > 32768 || (req.body !== undefined && Buffer.byteLength(JSON.stringify(req.body)) > 32768)) {
    res.statusCode = 413; res.end('Request too large'); return;
  }
  const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize:32768});
  // Additional scope is checked before parsed write calls reach the transport.
  const calls = Array.isArray(req.body) ? req.body : [req.body];
  if (calls.some((body: any) => body?.method === 'tools/call' && body?.params?.name === 'create_artwork')) {
    try {await (deps.auth || authorize)(req.headers.authorization, config, undefined, ['acs:read', CREATE_SCOPE]);}
    catch {res.setHeader('WWW-Authenticate', challenge(config, ['acs:read', CREATE_SCOPE], true)); res.statusCode = 403; res.end('Artwork creation scope required'); return;}
  }
  // Tool rechecks scope too, covering streamed bodies without parsed req.body.
  const server = createServer(async () => {throw new Error("Database runner required");}, config.resource, run => (deps.read || withReadDatabase)(config, run), {
    subject, write: run => (deps.write || withWriteDatabase)(config, run),
    authorizeWrite: () => (deps.auth || authorize)(req.headers.authorization, config, undefined, ['acs:read', CREATE_SCOPE]).then(() => {}),
  });
  res.on('close', () => {void server.close().catch(() => {});});
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {res.statusCode = 500; res.end('Connector request failed');}
  }
 };
}
export default makeHandler();
