import { getSupabaseBrowser } from "@/lib/supabase/browser";

export const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers
  });
};
