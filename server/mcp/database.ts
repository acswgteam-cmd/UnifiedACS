import pg from 'pg';
import type { Config } from './config.js';
export type Query = (sql: string, values?: unknown[]) => Promise<Record<string, any>[]>;
let pool: pg.Pool | undefined;
async function withDatabase<T>(config: Config, run: (query: Query) => Promise<T>, write = false): Promise<T> {
  pool ||= new pg.Pool({connectionString: config.databaseUrl, max: 2, idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000, ssl: {rejectUnauthorized: true, ...(config.databaseCa ? {ca: config.databaseCa} : {})}});
  const client = await pool.connect();
  try {
    await client.query(write ? 'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const {rows} = await client.query(`SELECT current_user AS username, rolsuper, rolbypassrls,
      pg_has_role(current_user, 'acs_mcp_reader', 'MEMBER') AS reader,
      EXISTS (SELECT 1 FROM pg_roles w WHERE w.rolname = 'acs_mcp_artwork_writer' AND pg_has_role(current_user, w.oid, 'MEMBER')) AS writer FROM pg_roles WHERE rolname = current_user`);
    if (rows[0]?.username !== 'acs_mcp_login' || rows[0]?.rolsuper || rows[0]?.rolbypassrls || !rows[0]?.reader) throw new Error('Invalid database role');
    if (write && !rows[0]?.writer) throw new Error('Artwork writer role required');
    const result = await run(async (sql, values) => (await client.query(sql, values)).rows);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export function withReadDatabase<T>(config: Config, run: (query: Query) => Promise<T>) { return withDatabase(config, run); }
export function withWriteDatabase<T>(config: Config, run: (query: Query) => Promise<T>) { return withDatabase(config, run, true); }
