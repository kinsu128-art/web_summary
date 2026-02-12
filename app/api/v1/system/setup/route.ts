import { ConfigError } from "@/lib/env";
import { errorResponse, ok } from "@/lib/http";
import { checkSupabaseSetup } from "@/lib/repositories/system";

export async function GET() {
  try {
    const result = await checkSupabaseSetup();
    if (!result.all_ok) {
      return errorResponse("CONFIG_ERROR", "Supabase schema is incomplete.", 503, result);
    }
    return ok(result);
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
