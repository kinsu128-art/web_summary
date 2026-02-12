import { deleteTag } from "@/lib/repositories/archive";
import { errorResponse, noContent } from "@/lib/http";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const { id } = await context.params;
    await deleteTag(userId, id);
    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete tag", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
