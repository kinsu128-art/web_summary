import { getSupabaseAdmin } from "@/lib/supabase/server";
import { errorResponse, getErrorMessage, ok } from "@/lib/http";
import { authSignUpSchema } from "@/lib/validation";

const isDuplicateEmailError = (message: string) => {
  const lower = message.toLowerCase();
  return lower.includes("already registered") || lower.includes("already exists");
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = authSignUpSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid signup payload", 400, {
        issues: parsed.error.issues
      });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true
    });

    if (error) {
      if (isDuplicateEmailError(error.message)) {
        return errorResponse("CONFLICT", "이미 가입된 이메일입니다.", 409);
      }
      throw error;
    }

    return ok({ user_id: data.user?.id ?? null }, 201);
  } catch (error) {
    const reason = getErrorMessage(error);
    if (isDuplicateEmailError(reason)) {
      return errorResponse("CONFLICT", "이미 가입된 이메일입니다.", 409, { reason });
    }
    return errorResponse("INTERNAL_ERROR", "회원가입 처리에 실패했습니다.", 500, { reason });
  }
}
