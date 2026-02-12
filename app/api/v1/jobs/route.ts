import { errorResponse, ok } from "@/lib/http";
import { ConfigError } from "@/lib/env";
import { listJobs } from "@/lib/repositories/archive";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));
    const items = await listJobs(limit);
    return ok({ items });
  } catch (error) {
    if (error instanceof ConfigError) {
      return errorResponse("CONFIG_ERROR", "Server is missing Supabase configuration.", 503, {
        missing: error.message
      });
    }
    return errorResponse("INTERNAL_ERROR", "Failed to load jobs", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
