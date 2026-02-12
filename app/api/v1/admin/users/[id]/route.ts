import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, getErrorMessage, noContent, ok } from "@/lib/http";
import { ADMIN_EMAIL, requireAdminUser } from "@/lib/auth/admin";

type Context = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    email_confirmed: z.boolean().optional()
  })
  .strict();

export const runtime = "nodejs";

export async function PATCH(request: Request, context: Context) {
  try {
    const adminCheck = await requireAdminUser(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid admin user payload.", 400, {
        issues: parsed.error.issues
      });
    }

    const client = getSupabaseAdmin();
    const { data: beforeData, error: beforeError } = await client.auth.admin.getUserById(id);
    if (beforeError || !beforeData.user) {
      return errorResponse("NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    }
    if ((beforeData.user.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return errorResponse("CONFLICT", "관리자 계정은 변경할 수 없습니다.", 409);
    }

    const { data, error } = await client.auth.admin.updateUserById(id, {
      email_confirm: parsed.data.email_confirmed
    });
    if (error) throw error;

    return ok({
      id: data.user.id,
      email: data.user.email ?? null,
      email_confirmed_at: data.user.email_confirmed_at ?? null
    });
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "사용자 정보 수정에 실패했습니다.", 500, {
      reason: getErrorMessage(error)
    });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const adminCheck = await requireAdminUser(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await context.params;
    if (adminCheck.user.id === id) {
      return errorResponse("CONFLICT", "현재 로그인한 관리자 계정은 삭제할 수 없습니다.", 409);
    }

    const client = getSupabaseAdmin();
    const { data: beforeData, error: beforeError } = await client.auth.admin.getUserById(id);
    if (beforeError || !beforeData.user) {
      return errorResponse("NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    }
    if ((beforeData.user.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      return errorResponse("CONFLICT", "관리자 계정은 삭제할 수 없습니다.", 409);
    }

    const { error } = await client.auth.admin.deleteUser(id);
    if (error) throw error;

    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "사용자 삭제에 실패했습니다.", 500, {
      reason: getErrorMessage(error)
    });
  }
}
