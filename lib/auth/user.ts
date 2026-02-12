import { createClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";
import { errorResponse } from "@/lib/http";

type RequestUser = {
  id: string;
  email: string | null;
};

const readBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

export const getUserFromRequest = async (request: Request): Promise<RequestUser | null> => {
  const accessToken = readBearerToken(request);
  if (!accessToken) return null;

  const client = createClient(required("NEXT_PUBLIC_SUPABASE_URL"), required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? null
  };
};

export const getUserIdFromRequest = async (request: Request) => {
  const user = await getUserFromRequest(request);
  return user?.id ?? null;
};

export const unauthorized = () => errorResponse("UNAUTHORIZED", "로그인이 필요합니다.", 401);
