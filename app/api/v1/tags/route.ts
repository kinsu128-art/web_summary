import { createTag, listTags } from "@/lib/repositories/archive";
import { errorResponse, getErrorMessage, isSchemaCacheError, ok } from "@/lib/http";
import { createTagSchema } from "@/lib/validation";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const items = await listTags(userId);
    return ok({ items });
  } catch (error) {
    if (isSchemaCacheError(error)) {
      return errorResponse("CONFIG_ERROR", "Supabase REST schema cache is not ready.", 503, {
        reason: getErrorMessage(error)
      });
    }
    return errorResponse("INTERNAL_ERROR", "Failed to load tags", 500, {
      reason: getErrorMessage(error)
    });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid tag payload", 400, {
        issues: parsed.error.issues
      });
    }
    const created = await createTag(userId, parsed.data.name, parsed.data.color);
    return ok(created, 201);
  } catch (error) {
    if (isSchemaCacheError(error)) {
      return errorResponse("CONFIG_ERROR", "Supabase REST schema cache is not ready.", 503, {
        reason: getErrorMessage(error)
      });
    }
    const message = getErrorMessage(error);
    if (message.includes("duplicate") || message.includes("unique")) {
      return errorResponse("CONFLICT", "Tag already exists", 409);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to create tag", 500, { reason: message });
  }
}
