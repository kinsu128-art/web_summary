import { errorResponse, ok } from "@/lib/http";
import { importDocumentSchema } from "@/lib/validation";
import { getUserIdFromRequest, unauthorized } from "@/lib/auth/user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return unauthorized();

    const body = await request.json();
    const parsed = importDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid import payload", 400, {
        issues: parsed.error.issues
      });
    }

    const { runImportDocument } = await import("@/lib/services/import-document");
    const result = await runImportDocument(userId, parsed.data);
    return ok(result, 202);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return errorResponse("INTERNAL_ERROR", "Failed to import document", 500, {
      reason
    });
  }
}
