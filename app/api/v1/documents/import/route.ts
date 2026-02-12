import { errorResponse, ok } from "@/lib/http";
import { runImportDocument } from "@/lib/services/import-document";
import { importDocumentSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = importDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid import payload", 400, {
        issues: parsed.error.issues
      });
    }

    const result = await runImportDocument(parsed.data);
    return ok(result, 202);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to import document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
