import { deleteFolder, updateFolder } from "@/lib/repositories/archive";
import { errorResponse, noContent, ok } from "@/lib/http";
import { updateFolderSchema } from "@/lib/validation";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid folder payload", 400, {
        issues: parsed.error.issues
      });
    }
    const updated = await updateFolder(userId, id, parsed.data);
    if (!updated) return errorResponse("NOT_FOUND", "Folder not found", 404);
    return ok(updated);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to update folder", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const { id } = await context.params;
    await deleteFolder(userId, id);
    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete folder", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
