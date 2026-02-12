"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/auth-fetch";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ADMIN_EMAIL = "kinsu128@gmail.com";

type SetupCheckItem = {
  table: string;
  ok: boolean;
  error: string | null;
};

export default function AdminSetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [setupOk, setSetupOk] = useState<boolean | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [setupItems, setSetupItems] = useState<SetupCheckItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email?.toLowerCase() ?? "";
      if (!data.session || email !== ADMIN_EMAIL.toLowerCase()) {
        router.replace("/");
        return;
      }
      setReady(true);
    });
  }, [router]);

  const fetchSetup = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/v1/admin/setup", { cache: "no-store" });
      const data = await response.json();
      const details = data?.error?.details;

      if (response.ok) {
        setSetupOk(true);
        setSetupMessage("Final status: OK");
        setSetupItems(Array.isArray(data?.tables) ? data.tables : []);
      } else {
        setSetupOk(false);
        setSetupMessage(data?.error?.message ?? "Final status: FAIL");
        setSetupItems(Array.isArray(details?.tables) ? details.tables : []);
      }
    } catch {
      setSetupOk(false);
      setSetupMessage("Final status: FAIL");
      setSetupItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void fetchSetup();
  }, [ready, fetchSetup]);

  if (!ready) {
    return (
      <main className="shell">
        <section className="panel auth-panel">
          <h2>관리자 권한 확인 중...</h2>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="panel">
        <div className="panel-head">
          <h2>Supabase Setup Health</h2>
          <div className="actions">
            <button disabled={loading} onClick={() => void fetchSetup()} type="button">
              {loading ? "확인 중..." : "다시 확인"}
            </button>
            <Link href="/admin">관리 홈</Link>
          </div>
        </div>
        {setupMessage ? <p className={`notice ${setupOk ? "ok" : "err"}`}>{setupMessage}</p> : null}
        <div className="list">
          {setupItems.map((item) => (
            <article key={item.table} className="item">
              <div className="item-head">
                <h3>{item.table}</h3>
                <span>{item.ok ? "OK" : "FAIL"}</span>
              </div>
              {!item.ok && item.error ? <p className="excerpt">{item.error}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
