-- Run in Supabase SQL Editor to verify web_summary setup.

select extname
from pg_extension
where extname in ('pgcrypto', 'pg_trgm')
order by extname;

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'documents',
    'captures',
    'tags',
    'document_tags',
    'folders',
    'document_folders',
    'import_jobs'
  )
order by table_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('documents', 'tags', 'import_jobs')
order by tablename, indexname;
