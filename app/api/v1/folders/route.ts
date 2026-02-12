import { createFolder, listFolders } from "@/lib/repositories/archive";
import { errorResponse, getErrorMessage, isSchemaCacheError, ok } from "@/lib/http";
import { createFolderSchema } from "@/lib/validation";

export async function GET() {
  try {
    const items = await listFolders();
    return ok({ items });
  } catch (error) {
    if (isSchemaCacheError(error)) {
      return errorResponse("CONFIG_ERROR", "Supabase REST schema cache is not ready.", 503, {
        reason: getErrorMessage(error)
      });
    }
    return errorResponse("INTERNAL_ERROR", "Failed to load folders", 500, {
      reason: getErrorMessage(error)
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid folder payload", 400, {
        issues: parsed.error.issues
      });
    }
    const created = await createFolder(parsed.data.name, parsed.data.description);
    return ok(created, 201);
  } catch (error) {
    if (isSchemaCacheError(error)) {
      return errorResponse("CONFIG_ERROR", "Supabase REST schema cache is not ready.", 503, {
        reason: getErrorMessage(error)
      });
    }
    const message = getErrorMessage(error);
    if (message.includes("duplicate") || message.includes("unique")) {
      return errorResponse("CONFLICT", "Folder already exists", 409);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to create folder", 500, { reason: message });
  }
}
