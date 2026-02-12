import { errorResponse, ok } from "@/lib/http";
import { rerunExtractionForDocument } from "@/lib/services/import-document";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(request: Request, context: Context) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const result = await rerunExtractionForDocument(userId, id);
    return ok(result, 200);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to re-extract document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
