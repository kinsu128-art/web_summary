import { errorResponse, ok } from "@/lib/http";
import { rerunExtractionForDocument } from "@/lib/services/import-document";

type Context = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const result = await rerunExtractionForDocument(id);
    return ok(result, 200);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to re-extract document", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
