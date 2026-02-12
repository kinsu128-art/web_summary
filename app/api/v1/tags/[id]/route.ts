import { deleteTag } from "@/lib/repositories/archive";
import { errorResponse, noContent } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteTag(id);
    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete tag", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
