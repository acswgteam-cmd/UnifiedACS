import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const preview = process.env.VERCEL_ENV === 'preview';
const branch = process.env.VERCEL_GIT_COMMIT_REF;
if (preview && (!branch || branch === 'feat/read-only-mcp')) {
  // This preview can become reachable by ChatGPT. Do not ship the admin frontend,
  // browser database keys, or cached frontend build output with it.
  rmSync('dist', { recursive: true, force: true });
  mkdirSync('dist', { recursive: true });
  writeFileSync('dist/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>UnifiedACS MCP Preview</title><body><h1>UnifiedACS MCP Preview</h1><p>This deployment serves the authenticated read-only MCP connector. The admin application is not included.</p></body></html>');
  console.log('MCP-only preview: admin frontend and assets excluded');
} else {
  const result = spawnSync('vite', ['build'], { stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
