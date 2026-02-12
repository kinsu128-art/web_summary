-- Per-user data isolation (multi-tenant scope)
-- Existing rows are assigned to kinsu128@gmail.com

alter table public.documents add column if not exists user_id uuid;
alter table public.tags add column if not exists user_id uuid;
alter table public.folders add column if not exists user_id uuid;
alter table public.import_jobs add column if not exists user_id uuid;

do $$
declare
  v_target_user_id uuid;
begin
  select id into v_target_user_id
  from auth.users
  where lower(email) = 'kinsu128@gmail.com'
  order by created_at asc
  limit 1;

  if v_target_user_id is null then
    raise exception 'Target user kinsu128@gmail.com not found in auth.users';
  end if;

  update public.documents set user_id = v_target_user_id where user_id is null;
  update public.tags set user_id = v_target_user_id where user_id is null;
  update public.folders set user_id = v_target_user_id where user_id is null;
  update public.import_jobs set user_id = v_target_user_id where user_id is null;
end $$;

alter table public.documents
  alter column user_id set not null;
alter table public.tags
  alter column user_id set not null;
alter table public.folders
  alter column user_id set not null;
alter table public.import_jobs
  alter column user_id set not null;

alter table public.documents
  add constraint fk_documents_user_id
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.tags
  add constraint fk_tags_user_id
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.folders
  add constraint fk_folders_user_id
  foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.import_jobs
  add constraint fk_import_jobs_user_id
  foreign key (user_id) references auth.users(id) on delete cascade;

drop index if exists public.ux_tags_name_lower;
alter table public.tags drop constraint if exists tags_name_key;
alter table public.folders drop constraint if exists folders_name_key;

create unique index if not exists ux_tags_user_name_lower on public.tags (user_id, lower(name));
create unique index if not exists ux_folders_user_name_lower on public.folders (user_id, lower(name));

create index if not exists idx_documents_user_id_created_at on public.documents (user_id, created_at desc);
create index if not exists idx_tags_user_id on public.tags (user_id);
create index if not exists idx_folders_user_id on public.folders (user_id);
create index if not exists idx_import_jobs_user_id_created_at on public.import_jobs (user_id, created_at desc);
