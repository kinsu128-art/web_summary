import { errorResponse } from "@/lib/http";
import { getUserFromRequest } from "@/lib/auth/user";

export const ADMIN_EMAIL = "kinsu128@gmail.com";

export const requireAdminUser = async (request: Request) => {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { ok: false as const, response: errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401) };
  }

  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false as const, response: errorResponse("UNAUTHORIZED", "관리자 권한이 필요합니다.", 403) };
  }

  return { ok: true as const, user };
};
