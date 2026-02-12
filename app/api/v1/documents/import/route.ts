import { createImportJob } from "@/lib/repositories/archive";
import { errorResponse, ok } from "@/lib/http";
import { importDocumentSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = importDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid import payload", 400, {
        issues: parsed.error.issues
      });
    }

    const job = await createImportJob(parsed.data.url);
    return ok({ job_id: job.id, status: job.status }, 202);
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to create import job", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
