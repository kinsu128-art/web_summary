# web_summary

Web study archive app scaffold with Next.js, Supabase, and Vercel.

## Stack
- Hosting: Vercel
- Database: Supabase PostgreSQL
- API spec: `api/openapi.yaml`
- DB schema migration: `supabase/migrations/202602120001_init.sql`

## Files
- Product plan: `plan.md`
- Deployment design: `design.md`
- API contract: `api/openapi.yaml`
- SQLite draft migration (legacy): `db/migrations/0001_init.sql`
- Supabase migration (active): `supabase/migrations/202602120001_init.sql`

## Local setup
1. Copy `.env.example` to `.env.local`
2. Fill Supabase and runtime variables
3. Apply migration SQL in Supabase
4. Install dependencies: `npm install`
5. Run dev server: `npm run dev`

## Deployment
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel
3. Deploy

## Implemented endpoints
- `GET /api/health`
- `POST /api/v1/documents/import`
- `GET /api/v1/documents`
- `GET/PATCH/DELETE /api/v1/documents/{id}`
- `GET /api/v1/jobs/{id}`
- `GET/POST /api/v1/tags`
- `DELETE /api/v1/tags/{id}`
- `GET/POST /api/v1/folders`
- `PATCH/DELETE /api/v1/folders/{id}`
