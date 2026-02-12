import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { required } from "@/lib/env";

let cachedClient: SupabaseClient<any> | null = null;

export const getSupabaseAdmin = () => {
  if (cachedClient) return cachedClient;
  cachedClient = createClient<any>(required("NEXT_PUBLIC_SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false }
  });
  return cachedClient;
};
