import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer as httpServer} from 'node:http';
import {once} from 'node:events';
import {generateKeyPair, SignJWT} from 'jose';
import {authorize, protectedResource} from '../server/mcp/auth.js';
import {loadConfig} from '../server/mcp/config.js';
import {schemas, executeTool} from '../server/mcp/tools.js';
import {makeHandler} from '../api/mcp.js';
import type {Query} from '../server/mcp/database.js';

const config = {resource:'https://acs.example/api/mcp', issuer:'https://identity.example/', jwks:'https://identity.example/jwks', allowedSubjects:['owner|1'], databaseUrl:'postgresql://acs_mcp_login:unused@localhost/postgres'};
const env = {MCP_RESOURCE_URL:config.resource, MCP_OAUTH_ISSUER:config.issuer, MCP_OAUTH_JWKS_URL:config.jwks, MCP_ALLOWED_SUBJECTS:'owner|1', MCP_DATABASE_URL:config.databaseUrl};
const projectId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const {publicKey, privateKey} = await generateKeyPair('RS256');
async function token(overrides: Record<string,any> = {}) {
 return new SignJWT({sub:'owner|1', scope:'acs:read', iss:config.issuer, aud:config.resource, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+300, ...overrides})
  .setProtectedHeader({alg:'RS256'}).sign(privateKey);
}
const auth = (header: string | undefined, c: typeof config, _key?: any, scopes?: string[]) => authorize(header, c, async () => publicKey, scopes);

test('configuration refuses missing auth, admin DB login and insecure TLS overrides', () => {
 assert.deepEqual(loadConfig(env).allowedSubjects,['owner|1']);
 assert.throws(()=>loadConfig({...env, MCP_ALLOWED_SUBJECTS:''}));
 assert.throws(()=>loadConfig({...env, MCP_OAUTH_ISSUER:'http://identity.example'}));
 assert.throws(()=>loadConfig({...env, MCP_DATABASE_URL:'postgresql://postgres:unused@localhost/postgres'}));
 assert.throws(()=>loadConfig({...env, MCP_DATABASE_URL:config.databaseUrl+'?sslmode=no-verify'}));
});
test('OAuth verifies signature, issuer, audience, expiration, scope and allowed user', async () => {
 assert.equal(await auth('Bearer '+await token(),config),'owner|1');
 for (const claims of [{iss:'https://wrong.example/'},{aud:'https://wrong.example/'},{exp:1},{scope:'acs:write'},{sub:'other|2'},{nbf:Math.floor(Date.now()/1000)+1000}]) {
  await assert.rejects(()=>token(claims).then(t=>auth('Bearer '+t,config)));
 }
 await assert.rejects(()=>auth(undefined,config));
 const {privateKey: wrongKey} = await generateKeyPair('RS256');
 const bad = await new SignJWT({sub:'owner|1',scope:'acs:read'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience(config.resource).setIssuedAt().setExpirationTime('5m').sign(wrongKey);
 await assert.rejects(()=>auth('Bearer '+bad,config));
 assert.equal(protectedResource(config).resource,config.resource);
});
test('arguments reject unbounded requests, malformed IDs, impossible dates and reversed ranges', () => {
 assert.throws(()=>schemas.search_projects.parse({limit:51}));
 assert.throws(()=>schemas.search_projects.parse({query:'x'.repeat(121)}));
 assert.throws(()=>schemas.search_projects.parse({sql:'DROP TABLE projects'}));
 assert.throws(()=>schemas.get_task_updates.parse({task_id:'not-an-id'}));
 assert.throws(()=>schemas.list_internal_tasks.parse({deadline_to:'2026-02-30'}));
 assert.throws(()=>schemas.list_internal_tasks.parse({deadline_from:'2026-05-01',deadline_to:'2026-04-01'}));
});
test('search binds SQL injection/wildcards and signals pagination without guessing a project', async () => {
 let values: unknown[] = [];
 const q: Query = async (sql,v) => {assert.match(sql,/^SELECT/); values=v!; return [{id:projectId},{id:taskId}];};
 const output = await executeTool('search_projects',{query:"%' OR 1=1 --_",limit:1},q,config.resource);
 assert.equal(values[0],"%\\%' OR 1=1 --\\_%");
 assert.equal((output.items as any[]).length,1); assert.equal(output.has_more,true); assert.equal(output.next_offset,1);
});
test('project details distinguish project, support and artwork PIC and bound both lists', async () => {
 const q: Query = async sql => {
  if (sql.includes('FROM public.projects')) return [{id:projectId,project_pic_name:'Project owner',support_designer_ids:[taskId]}];
  if (sql.includes('SELECT id, name')) return [{id:taskId,name:'Support'}];
  if (sql.includes('FROM public.project_checklists')) return [{id:'a'},{id:'b'}];
  return [{id:'a', artwork_pic_name:'Artwork owner'}];
 };
 const out = await executeTool('get_project_details',{project_id:projectId,limit:1},q,config.resource);
 assert.equal((out.project as any).project_pic_name,'Project owner');
 assert.equal((out.project as any).support_designers[0].name,'Support');
 assert.equal((out.artwork as any).items[0].artwork_pic_name,'Artwork owner');
 assert.equal((out.checklist as any).has_more,true);
});
test('updates clean hidden history, preserve note PIC and flag missing tasks', async () => {
 const q: Query = async sql => sql.includes('FROM public.internal_designs') ? [{id:taskId}] : [{note:'<b>Hello</b><!-- STATUS_HISTORY_START\nprivate history\nSTATUS_HISTORY_END -->',note_pic_name:'Designer',changed_by:'Admin'}];
 const out = await executeTool('get_task_updates',{task_id:taskId},q,config.resource);
 assert.equal((out.updates as any).items[0].note,'Hello');
 assert.equal((out.updates as any).items[0].note_pic_name,'Designer');
 const missing = await executeTool('get_task_updates',{task_id:taskId},async()=>[],config.resource);
 assert.equal(missing.found,false); assert.equal(missing.task_id,taskId);
});
test('HTTP MCP handshake, tool discovery, calls and fail-closed errors with no database reads before authentication', async t => {
 let reads=0;
 const handler=makeHandler({config:()=>config,auth, read:async (_c,run)=>run(async () => {reads++; return [];})});
 const server=httpServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.close();server.closeAllConnections();});
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/mcp`;
 const headers={authorization:'Bearer '+await token(),'content-type':'application/json',accept:'application/json, text/event-stream'};
 const post=(body:unknown, h:Record<string,string>=headers)=>fetch(url,{method:'POST',headers:h,body:JSON.stringify(body)});
 let res=await post({jsonrpc:'2.0',id:1,method:'tools/list'}, {...headers,authorization:''});
 assert.equal(res.status,401);assert.match(res.headers.get('www-authenticate')!,/oauth-protected-resource/); assert.equal(reads,0);
 res=await post({jsonrpc:'2.0',id:2,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'test',version:'1'}}});
 assert.equal(res.status,200);assert.equal((await res.json()).result.serverInfo.name,'unified-acs');
 res=await post({jsonrpc:'2.0',id:3,method:'tools/list'});
 const tools=(await res.json()).result.tools;assert.equal(tools.length,6);assert.equal(tools.filter((x:any)=>x.annotations.readOnlyHint).length,5);assert.equal(tools.find((x:any)=>x.name==='create_artwork').annotations.readOnlyHint,false);assert.equal(reads,0);
 res=await post({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'search_projects',arguments:{query:'Test'}}});
 const output=await res.json();assert.equal(output.result.structuredContent.items.length,0);assert.equal(reads,1);
 res=await post({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'search_projects',arguments:{limit:999}}});
 assert.equal((await res.json()).result.isError,true);assert.equal(reads,1);
 assert.equal((await fetch(url,{headers})).status,405);
 assert.equal((await post({}, {...headers,origin:'https://evil.example'})).status,403);
 assert.equal((await post({payload:'x'.repeat(40000)})).status,413);
});
test('unconfigured deployment returns 503 without invoking auth or DB', async t => {
 const server=httpServer(makeHandler({config:()=>{throw new Error('secret config');},auth:async()=>{throw new Error('must not run');}}));
 server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});
 const res=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/mcp`);
 assert.equal(res.status,503);assert.equal(await res.text(),'Connector is not configured');
});

test('artwork validation rejects impossible dates, backwards ranges, unknown fields and missing PIC', async () => {
 const {createArtworkSchema} = await import('../server/mcp/artwork.js');
 const args={request_id:taskId,project_id:projectId,artwork_name:'KV',artwork_type:'2D Design',pic_designer_id:taskId,start_date:'2026-10-07'};
 assert.equal(createArtworkSchema.parse(args).revision_count,0);
 for (const invalid of [{start_date:'2026-02-30'},{end_date:'2026-10-06'},{artwork_type:'Other'},{revision_count:-1},{pic_designer_id:undefined},{sql:'DROP TABLE x'},{created_at:'2026-10-07'}]) assert.throws(()=>createArtworkSchema.parse({...args,...invalid}));
});
test('artwork insertion binds values, verifies active PIC and uses one stable audited request', async () => {
 const {createArtwork} = await import('../server/mcp/artwork.js');
 const args={request_id:taskId,project_id:projectId,artwork_name:"KV '); DROP TABLE projects;--",artwork_type:'2D Design',pic_designer_id:taskId,start_date:'2026-10-07'};
 let audit:any; let inserts=0;
 const q:Query=async(sql,v)=>{
  if(sql.startsWith('SELECT pg_advisory')) return [];
  if(sql.includes('FROM acs_mcp_private')) return audit?[audit]:[];
  if(sql.includes('FROM public.projects')) return [{id:projectId,project_name:'Project'}];
  if(sql.includes('FROM public.designers')) return [{id:taskId,name:'Sofyan',active:true}];
  if(sql.startsWith('INSERT INTO public.artwork_logs')) {inserts++;assert.equal(v![2],args.artwork_name);assert.ok(!sql.includes(args.artwork_name));return [{id:taskId,created_at:'2026-10-07T00:00:00Z'}];}
  if(sql.startsWith('INSERT INTO acs_mcp_private')) {audit={actor_subject:v![1],input_hash:v![2],result:JSON.parse(v![3] as string)};return [];}
  throw new Error('Unexpected SQL');
 };
 const first=await createArtwork(args,q,'owner|1');assert.equal(first.created,true);
 const replay=await createArtwork(args,q,'owner|1');assert.equal(replay.replayed,true);assert.equal(inserts,1);
 await assert.rejects(()=>createArtwork({...args,artwork_name:'Different'},q,'owner|1'),/different input/);
 await assert.rejects(()=>createArtwork(args,q,'other|2'),/different input/);
 const invalid:Query=async sql=>sql.includes('FROM public.projects')?[{id:projectId}]:sql.includes('FROM public.designers')?[{id:taskId,active:false}]:[];
 await assert.rejects(()=>createArtwork(args,invalid,'owner|1'),/active designer/);
});
test('HTTP write calls require both scopes and never reach database with read-only tokens', async t => {
 let writes=0;
 const handler=makeHandler({config:()=>config,auth,read:async(_c,run)=>run(async()=>[]),write:async(_c,run)=>{writes++;return run(async sql=>sql.includes('FROM public.projects')?[{id:projectId}]:sql.includes('FROM public.designers')?[{id:taskId,name:'Designer',active:true}]:sql.startsWith('INSERT INTO public.artwork_logs')?[{id:taskId,created_at:'2026-10-07T00:00:00Z'}]:[]);}});
 const server=httpServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.close();server.closeAllConnections();});
 const url=`http://127.0.0.1:${(server.address() as any).port}/api/mcp`;
 const call={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_artwork',arguments:{request_id:taskId,project_id:projectId,artwork_name:'KV',artwork_type:'2D Design',pic_designer_id:taskId,start_date:'2026-10-07'}}};
 const post=async(scope:string)=>fetch(url,{method:'POST',headers:{authorization:'Bearer '+await token({scope}),'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify(call)});
 const denied=await post('acs:read');const body=await denied.json();assert.equal(body.result.isError,true);assert.match(body.result._meta['mcp/www_authenticate'],/insufficient_scope/);assert.equal(writes,0);
 const permitted=await post('acs:read acs:artwork:create');assert.equal(permitted.status,200);assert.equal((await permitted.json()).result.structuredContent.created,true);assert.equal(writes,1);
 assert.equal((await post('acs:artwork:create')).status,401);
 // Exercise Vercel's parsed-body path and its HTTP 403 scope challenge as well.
 const parsed=httpServer((req,res)=>{(req as any).body=call;void handler(req,res);});parsed.listen(0,'127.0.0.1');await once(parsed,'listening');t.after(()=>{parsed.close();parsed.closeAllConnections();});
 const deniedParsed=await fetch(`http://127.0.0.1:${(parsed.address() as any).port}/api/mcp`,{method:'POST',headers:{authorization:'Bearer '+await token()}});
 assert.equal(deniedParsed.status,403);assert.match(deniedParsed.headers.get('www-authenticate')!,/acs:artwork:create/);assert.equal(writes,1);
});
