import { createTag, listTags } from "@/lib/repositories/archive";
import { errorResponse, ok } from "@/lib/http";
import { createTagSchema } from "@/lib/validation";

export async function GET() {
  try {
    const items = await listTags();
    return ok({ items });
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load tags", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid tag payload", 400, {
        issues: parsed.error.issues
      });
    }
    const created = await createTag(parsed.data.name, parsed.data.color);
    return ok(created, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("duplicate") || message.includes("unique")) {
      return errorResponse("CONFLICT", "Tag already exists", 409);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to create tag", 500, { reason: message });
  }
}
