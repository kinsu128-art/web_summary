import { createClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";
import { errorResponse, getErrorMessage, noContent } from "@/lib/http";
import { getSupabaseAdmin } from "@/lib/supabase/server";

const readBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export async function DELETE(request: Request) {
  try {
    const accessToken = readBearerToken(request);
    if (!accessToken) {
      return errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    }

    const userClient = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !data.user) {
      return errorResponse("UNAUTHORIZED", "유효한 로그인 정보가 필요합니다.", 401);
    }

    const admin = getSupabaseAdmin();
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) {
      throw deleteError;
    }

    return noContent();
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "회원 탈퇴 처리에 실패했습니다.", 500, {
      reason: getErrorMessage(error)
    });
  }
}
