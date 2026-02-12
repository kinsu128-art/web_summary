"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ADMIN_EMAIL = "kinsu128@gmail.com";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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
          <h2>관리 페이지</h2>
          <Link href="/">메인으로</Link>
        </div>
        <div className="list">
          <article className="item">
            <div className="item-head">
              <h3>사용자 관리</h3>
            </div>
            <p className="excerpt">사용자 목록 확인, 이메일 인증 처리, 계정 삭제를 수행합니다.</p>
            <div className="actions">
              <Link href="/admin/users">사용자 관리 열기</Link>
            </div>
          </article>
          <article className="item">
            <div className="item-head">
              <h3>Supabase Setup Health</h3>
            </div>
            <p className="excerpt">마이그레이션/테이블 구성 상태를 확인합니다.</p>
            <div className="actions">
              <Link href="/admin/setup">설정 상태 열기</Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
