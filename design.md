# Web Summary Deployment Design (GitHub + Vercel + Supabase)

## 1. Target stack
- Hosting: Vercel
- Database: Supabase (PostgreSQL)
- API contract: `api/openapi.yaml`
- DB migration: `supabase/migrations/202602120001_init.sql`

## 2. Repository strategy
- GitHub owner: `kinsu128-art`
- Repository name: `web_summary`
- Main branch: `main`

## 3. Environment variables
Use runtime secrets in Vercel project settings. Do not commit real keys.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_ACCESS_TOKEN` (optional, CLI only)

Reference template: `.env.example`

## 4. Supabase migration flow
1. Create Supabase project
2. Apply SQL in `supabase/migrations/202602120001_init.sql`
3. Verify tables:
   - `documents`, `captures`, `tags`, `document_tags`
   - `folders`, `document_folders`, `import_jobs`
4. Verify triggers:
   - `set_updated_at`
   - `documents_set_search_vector`

## 5. Vercel deployment flow
1. Import `web_summary` repository in Vercel
2. Set environment variables from section 3
3. Deploy to production
4. Validate API health after first deploy

## 6. Security baseline
- Keep service role key only in server runtime
- Never expose service role key to browser/client bundle
- Keep `.env.local` ignored by git
- Rotate keys if leaked

## 7. Next implementation steps
1. Generate backend route skeleton from `api/openapi.yaml`
2. Implement Supabase repository layer
3. Implement import pipeline (fetch -> readability -> markdown -> save)
4. Implement archive list/detail UI
