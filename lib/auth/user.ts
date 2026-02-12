import { createClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";
import { errorResponse } from "@/lib/http";

const readBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export const getUserIdFromRequest = async (request: Request) => {
  const accessToken = readBearerToken(request);
  if (!accessToken) return null;

  const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
};

export const unauthorized = () => errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
