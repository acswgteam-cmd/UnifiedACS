-- MANUAL setup for the private HOD connector. This is not an automatic app migration.
-- Run existing changelog migrations first. Transaction rolls back if a column is absent.
-- Dedicated roles must not be members of other roles or own app objects.
BEGIN;
CREATE ROLE acs_mcp_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE acs_mcp_login NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
GRANT acs_mcp_reader TO acs_mcp_login;
GRANT USAGE ON SCHEMA public TO acs_mcp_reader;
GRANT CONNECT ON DATABASE postgres TO acs_mcp_login;
GRANT SELECT (id, name) ON public.designers TO acs_mcp_reader;
GRANT SELECT (id, department_name) ON public.departments TO acs_mcp_reader;
GRANT SELECT (id, project_name, start_date, end_date, locations, project_type, status, pic_designer_id, support_designer_ids)
 ON public.projects TO acs_mcp_reader;
GRANT SELECT (id, project_id, task_name, size, quantity, status) ON public.project_checklists TO acs_mcp_reader;
GRANT SELECT (id, work_context, project_id, artwork_name, artwork_type, start_date, end_date, pic_designer_id)
 ON public.artwork_logs TO acs_mcp_reader;
GRANT SELECT (id, task_name, deadline, status, department_id, requester_name, created_at)
 ON public.internal_designs TO acs_mcp_reader;
GRANT SELECT (id, internal_design_id, change_type, old_value, new_value, note, note_title, note_deadline, note_status, pic_designer_id, changed_by, created_at)
 ON public.internal_design_changelog TO acs_mcp_reader;
-- These policies only apply when RLS is enabled. They give the HOD reader access to all
-- rows in these seven tables; grants still restrict columns. Existing app policies are untouched.
CREATE POLICY acs_mcp_select ON public.designers FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.departments FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.projects FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.project_checklists FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.artwork_logs FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.internal_designs FOR SELECT TO acs_mcp_reader USING (true);
CREATE POLICY acs_mcp_select ON public.internal_design_changelog FOR SELECT TO acs_mcp_reader USING (true);
ALTER ROLE acs_mcp_login SET default_transaction_read_only = on;
ALTER ROLE acs_mcp_login SET statement_timeout = '5s';
-- Abort setup if legacy PUBLIC grants would give this role write privileges or access
-- to unrelated tables. Fix those grants deliberately; do not silently change app access.
DO $$
DECLARE t record;
BEGIN
 FOR t IN SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') LOOP
  IF has_table_privilege('acs_mcp_login', t.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
   RAISE EXCEPTION 'Reader has unwanted write privileges on %', t.relname;
  END IF;
  IF t.relname NOT IN ('designers','departments','projects','project_checklists','artwork_logs','internal_designs','internal_design_changelog')
     AND has_any_column_privilege('acs_mcp_login', t.oid, 'SELECT') THEN
   RAISE EXCEPTION 'Reader can access unrelated table %', t.relname;
  END IF;
 END LOOP;
END $$;
COMMIT;
-- Enable login with a newly generated strong password separately in Supabase SQL Editor:
-- ALTER ROLE acs_mcp_login LOGIN PASSWORD '<PRIVATE_RANDOM_PASSWORD>';
-- Never commit the actual password. Disable immediately: ALTER ROLE acs_mcp_login NOLOGIN;
