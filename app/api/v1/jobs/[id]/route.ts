import { getJobById } from "@/lib/repositories/archive";
import { errorResponse, ok } from "@/lib/http";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const data = await getJobById(userId, id);
    if (!data) return errorResponse("NOT_FOUND", "Job not found", 404);
    return ok(data);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load job", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
