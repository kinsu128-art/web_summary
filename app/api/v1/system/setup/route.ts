import { ConfigError } from "@/lib/env";
import { errorResponse, ok } from "@/lib/http";
import { checkSupabaseSetup } from "@/lib/repositories/system";

export async function GET() {
  try {
    const result = await checkSupabaseSetup();
    const projectRef = (() => {
      try {
        const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!raw) return null;
        const host = new URL(raw).hostname;
        return host.split(".")[0] ?? null;
      } catch {
        return null;
      }
    })();

    if (!result.all_ok) {
      return errorResponse("CONFIG_ERROR", "Supabase schema is incomplete.", 503, {
        ...result,
        project_ref: projectRef,
        hint: "Apply migrations to this exact project_ref and run: NOTIFY pgrst, 'reload schema';"
      });
    }
    return ok({
      ...result,
      project_ref: projectRef
    });
  } catch (error) {
    if (error instanceof ConfigError) {
      return errorResponse("CONFIG_ERROR", "Server is missing Supabase configuration.", 503, {
        missing: error.message
      });
    }
    return errorResponse("INTERNAL_ERROR", "Failed to verify Supabase setup.", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
