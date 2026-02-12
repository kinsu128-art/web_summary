import { getSupabaseAdmin } from "@/lib/supabase/server";

const requiredTables = [
  "documents",
  "captures",
  "tags",
  "document_tags",
  "folders",
  "document_folders",
  "import_jobs"
] as const;

export type SetupTableCheck = {
  table: string;
  ok: boolean;
  error: string | null;
};

export const checkSupabaseSetup = async () => {
  const db = getSupabaseAdmin();

  const checks = await Promise.all(
    requiredTables.map(async (table): Promise<SetupTableCheck> => {
      const { error } = await db.from(table).select("*").limit(1);
      return {
        table,
        ok: !error,
        error: error?.message ?? null
      };
    })
  );

  const allOk = checks.every((check) => check.ok);
  return {
    all_ok: allOk,
    tables: checks
  };
};
