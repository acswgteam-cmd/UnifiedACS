-- Read-only privilege inspection; run as project owner in SQL Editor after setup.
-- The first result should show a nonsuperuser/non-bypass role and only reader membership.
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles WHERE rolname IN ('acs_mcp_login','acs_mcp_reader');
SELECT parent.rolname AS member_of FROM pg_auth_members m
JOIN pg_roles child ON child.oid=m.member JOIN pg_roles parent ON parent.oid=m.roleid
WHERE child.rolname='acs_mcp_login';
-- The following two results must be EMPTY. These inspect effective grants including PUBLIC.
SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
AND has_table_privilege('acs_mcp_login',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
AND c.relname NOT IN ('designers','departments','projects','project_checklists','artwork_logs','internal_designs','internal_design_changelog')
AND has_any_column_privilege('acs_mcp_login',c.oid,'SELECT');
-- Check exact column grants if legacy PUBLIC column/table grants exist.
SELECT c.relname, a.attname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')
AND has_column_privilege('acs_mcp_login',c.oid,a.attnum,'SELECT') ORDER BY c.relname,a.attnum;
