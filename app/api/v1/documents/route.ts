import { listDocuments } from "@/lib/repositories/archive";
import { errorResponse, ok } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

    const q = searchParams.get("q") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const folderId = searchParams.get("folder_id") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const sort = (searchParams.get("sort") as "created_at" | "title" | null) ?? "created_at";
    const order = (searchParams.get("order") as "asc" | "desc" | null) ?? "desc";

    const result = await listDocuments({
      q,
      tag,
      folderId,
      status,
      sort,
      order,
      page,
      limit
    });

    return ok({
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total
      }
    });
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Failed to load documents", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
