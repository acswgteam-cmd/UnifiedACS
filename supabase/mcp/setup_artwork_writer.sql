-- Extends the existing MCP login with append-only PROJECT artwork creation.
-- No passwords, frontend grants or existing RLS configuration are changed.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='acs_mcp_artwork_writer') THEN
  CREATE ROLE acs_mcp_artwork_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
GRANT acs_mcp_artwork_writer TO acs_mcp_login;
GRANT USAGE ON SCHEMA public TO acs_mcp_artwork_writer;
GRANT SELECT (active) ON public.designers TO acs_mcp_reader;
GRANT SELECT (created_at) ON public.artwork_logs TO acs_mcp_reader;
GRANT SELECT (revision_count,approval_required,notes) ON public.artwork_logs TO acs_mcp_artwork_writer;
GRANT INSERT (id,work_context,project_id,artwork_name,artwork_type,pic_designer_id,start_date,end_date,revision_count,approval_required,notes)
 ON public.artwork_logs TO acs_mcp_artwork_writer;
CREATE SCHEMA IF NOT EXISTS acs_mcp_private;
REVOKE ALL ON SCHEMA acs_mcp_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA acs_mcp_private TO acs_mcp_artwork_writer;
CREATE TABLE IF NOT EXISTS acs_mcp_private.artwork_creations (
 request_id uuid PRIMARY KEY,
 actor_subject text NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 500),
 input_hash text NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acs_mcp_private.artwork_creations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON acs_mcp_private.artwork_creations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON acs_mcp_private.artwork_creations TO acs_mcp_artwork_writer;
DROP POLICY IF EXISTS acs_mcp_audit_select ON acs_mcp_private.artwork_creations;
CREATE POLICY acs_mcp_audit_select ON acs_mcp_private.artwork_creations FOR SELECT TO acs_mcp_artwork_writer USING (true);
DROP POLICY IF EXISTS acs_mcp_audit_insert ON acs_mcp_private.artwork_creations;
CREATE POLICY acs_mcp_audit_insert ON acs_mcp_private.artwork_creations FOR INSERT TO acs_mcp_artwork_writer WITH CHECK (true);
DROP POLICY IF EXISTS acs_mcp_artwork_insert ON public.artwork_logs;
CREATE POLICY acs_mcp_artwork_insert ON public.artwork_logs FOR INSERT TO acs_mcp_artwork_writer
 WITH CHECK (work_context='PROJECT' AND project_id IS NOT NULL AND lead_id IS NULL AND department_id IS NULL AND internal_design_id IS NULL);
-- This invoker trigger constrains MCP inserts independently of existing RLS.
-- Review the application access model separately before changing its policies.
CREATE OR REPLACE FUNCTION acs_mcp_private.enforce_artwork_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user = 'acs_mcp_login' THEN
  IF NEW.work_context <> 'PROJECT' OR NEW.project_id IS NULL OR NEW.pic_designer_id IS NULL
     OR NEW.lead_id IS NOT NULL OR NEW.department_id IS NOT NULL OR NEW.internal_design_id IS NOT NULL
     OR NEW.artwork_type NOT IN ('2D Design','3D Design','Video') OR NEW.artwork_type IS NULL
     OR length(trim(NEW.artwork_name)) NOT BETWEEN 1 AND 200 OR NEW.start_date IS NULL
     OR (NEW.end_date IS NOT NULL AND NEW.end_date < NEW.start_date)
     OR NEW.revision_count IS NULL OR NEW.revision_count NOT BETWEEN 0 AND 10000
     OR NEW.approval_required IS NULL OR length(coalesce(NEW.notes,'')) > 4000
     OR NOT EXISTS (SELECT 1 FROM public.designers d WHERE d.id=NEW.pic_designer_id AND d.active=true) THEN
   RAISE EXCEPTION 'Invalid MCP project artwork' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION acs_mcp_private.enforce_artwork_insert() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION acs_mcp_private.enforce_artwork_insert() TO acs_mcp_login;
DROP TRIGGER IF EXISTS acs_mcp_artwork_guard ON public.artwork_logs;
CREATE TRIGGER acs_mcp_artwork_guard BEFORE INSERT ON public.artwork_logs
 FOR EACH ROW EXECUTE FUNCTION acs_mcp_private.enforce_artwork_insert();
-- Keep the safe default: write transactions must explicitly opt into READ WRITE.
ALTER ROLE acs_mcp_login SET default_transaction_read_only=on;
COMMIT;
