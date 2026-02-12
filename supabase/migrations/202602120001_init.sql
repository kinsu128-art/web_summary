-- Supabase/PostgreSQL initial schema for web_summary
-- Run with Supabase migration workflow (or SQL Editor).

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  canonical_url text,
  source_domain text,
  title text not null,
  user_title text,
  excerpt text,
  content_markdown text not null,
  content_html text,
  author text,
  published_at timestamptz,
  language text not null default 'ko',
  reading_minutes integer not null default 0,
  content_hash text,
  status text not null default 'ready' check (status in ('ready', 'processing', 'failed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_documents_created_at on public.documents (created_at desc);
create index if not exists idx_documents_source_domain on public.documents (source_domain);
create index if not exists idx_documents_status on public.documents (status);
create index if not exists idx_documents_content_hash on public.documents (content_hash);

-- full-text search (PostgreSQL)
alter table public.documents
  add column if not exists search_vector tsvector;

create index if not exists idx_documents_search_vector on public.documents using gin (search_vector);
create index if not exists idx_documents_title_trgm on public.documents using gin (title gin_trgm_ops);

-- captures
create table if not exists public.captures (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  raw_html text,
  cleaned_html text,
  extractor text not null,
  extractor_version text,
  extract_score double precision,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_captures_document_id on public.captures (document_id);

-- tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#4A5568',
  created_at timestamptz not null default now()
);

create table if not exists public.document_tags (
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, tag_id)
);

create index if not exists idx_document_tags_tag_id on public.document_tags (tag_id);

-- folders
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.document_folders (
  document_id uuid not null references public.documents(id) on delete cascade,
  folder_id uuid not null references public.folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, folder_id)
);

create index if not exists idx_document_folders_folder_id on public.document_folders (folder_id);

-- import jobs
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  status text not null check (status in ('queued', 'fetching', 'extracting', 'saving', 'done', 'failed')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  document_id uuid references public.documents(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_import_jobs_status on public.import_jobs (status);
create index if not exists idx_import_jobs_created_at on public.import_jobs (created_at desc);

-- trigger helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.documents_set_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.user_title, new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.content_markdown, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_import_jobs_updated_at on public.import_jobs;
create trigger trg_import_jobs_updated_at
before update on public.import_jobs
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_documents_search_vector on public.documents;
create trigger trg_documents_search_vector
before insert or update on public.documents
for each row execute procedure public.documents_set_search_vector();

-- backfill search_vector
update public.documents
set search_vector =
  setweight(to_tsvector('simple', coalesce(user_title, title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(content_markdown, '')), 'C')
where search_vector is null;

-- RLS defaults: backend-only access pattern (service role on server)
alter table public.documents enable row level security;
alter table public.captures enable row level security;
alter table public.tags enable row level security;
alter table public.document_tags enable row level security;
alter table public.folders enable row level security;
alter table public.document_folders enable row level security;
alter table public.import_jobs enable row level security;

-- no anon/authenticated policies by default
