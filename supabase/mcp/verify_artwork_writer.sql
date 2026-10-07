-- Expect writer_member/can_insert/can_read_input_time = true;
-- can_update/can_delete/can_forge_input_time = false.
SELECT pg_has_role('acs_mcp_login','acs_mcp_artwork_writer','MEMBER') AS writer_member,
 has_column_privilege('acs_mcp_login','public.artwork_logs','artwork_name','INSERT') AS can_insert,
 has_any_column_privilege('acs_mcp_login','public.artwork_logs','UPDATE') AS can_update,
 has_table_privilege('acs_mcp_login','public.artwork_logs','DELETE') AS can_delete,
 has_column_privilege('acs_mcp_login','public.artwork_logs','created_at','INSERT') AS can_forge_input_time,
 has_column_privilege('acs_mcp_login','public.artwork_logs','created_at','SELECT') AS can_read_input_time;
-- No rows expected: no write privileges outside artwork/audit INSERT.
SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','acs_mcp_private') AND c.relkind IN ('r','p')
 AND (has_any_column_privilege('acs_mcp_login',c.oid,'UPDATE')
 OR has_table_privilege('acs_mcp_login',c.oid,'DELETE,TRUNCATE,TRIGGER,REFERENCES')
 OR (has_any_column_privilege('acs_mcp_login',c.oid,'INSERT')
 AND NOT ((n.nspname='public' AND c.relname='artwork_logs') OR (n.nspname='acs_mcp_private' AND c.relname='artwork_creations'))));
