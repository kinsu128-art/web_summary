import { deleteDocument, getDocumentById, updateDocument } from "@/lib/repositories/archive";
import { errorResponse, noContent, ok } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const data = await getDocumentById(id);
    if (!data) return errorResponse("NOT_FOUND", "Document not found", 404);
    return ok(data);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid update payload", 400, {
        issues: parsed.error.issues
      });
    }

    const updated = await updateDocument(id, parsed.data);
    if (!updated) return errorResponse("NOT_FOUND", "Document not found", 404);
    return ok(updated);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to update document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function DELETE(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    await deleteDocument(id);
    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to delete document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
