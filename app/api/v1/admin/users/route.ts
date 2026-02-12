import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, getErrorMessage, ok } from "@/lib/http";
import { requireAdminUser } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const adminCheck = await requireAdminUser(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? "50")));

    const client = getSupabaseAdmin();
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage
    });
    if (error) throw error;

    const items = (data.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      created_at: user.created_at
    }));

    return ok({
      items,
      page,
      per_page: perPage,
      total: data.total ?? items.length
    });
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "사용자 목록 조회에 실패했습니다.", 500, {
      reason: getErrorMessage(error)
    });
  }
}
