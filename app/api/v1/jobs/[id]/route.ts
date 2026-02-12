import { getJobById } from "@/lib/repositories/archive";
import { errorResponse, ok } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const data = await getJobById(id);
    if (!data) return errorResponse("NOT_FOUND", "Job not found", 404);
    return ok(data);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load job", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
