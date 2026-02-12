-- Harden schema constraints for stable behavior

-- Prevent case-only duplicate tags (e.g. React vs react)
create unique index if not exists ux_tags_name_lower on public.tags ((lower(name)));
