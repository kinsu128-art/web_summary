"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/supabase/auth-fetch";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ADMIN_EMAIL = "kinsu128@gmail.com";

type AdminUser = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/v1/admin/users?per_page=100", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "사용자 목록 조회에 실패했습니다.");
      setUsers(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사용자 목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email?.toLowerCase() ?? "";
      if (!data.session || email !== ADMIN_EMAIL.toLowerCase()) {
        router.replace("/");
        return;
      }
      setIsReady(true);
      void loadUsers();
    });
  }, [loadUsers, router]);

  const toggleConfirm = async (user: AdminUser) => {
    setWorkingUserId(user.id);
    setError(null);
    setMessage(null);
    try {
      const shouldConfirm = !user.email_confirmed_at;
      const response = await authFetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_confirmed: shouldConfirm })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: { message?: string } })?.error?.message ?? "수정 실패");

      setMessage(shouldConfirm ? "이메일 인증 처리 완료" : "이메일 미인증 상태로 변경");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "사용자 수정 실패");
    } finally {
      setWorkingUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    const confirmed = window.confirm(`${user.email ?? "사용자"} 계정을 삭제할까요?`);
    if (!confirmed) return;

    setWorkingUserId(user.id);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/api/v1/admin/users/${user.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "삭제 실패");
      }
      setMessage("사용자 계정을 삭제했습니다.");
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "사용자 삭제 실패");
    } finally {
      setWorkingUserId(null);
    }
  };

  if (!isReady) {
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
          <h2>사용자 관리</h2>
          <div className="actions">
            <button onClick={() => void loadUsers()} type="button">
              새로고침
            </button>
            <Link href="/admin">관리 홈</Link>
            <Link href="/">메인으로</Link>
          </div>
        </div>
        {message ? <p className="notice ok">{message}</p> : null}
        {error ? <p className="notice err">{error}</p> : null}
        {loading ? <p>불러오는 중...</p> : null}

        <div className="list">
          {users.map((user) => (
            <article key={user.id} className="item">
              <div className="item-head">
                <h3>{user.email ?? "(no email)"}</h3>
                <span>{new Date(user.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <p className="meta">
                <span>인증: {user.email_confirmed_at ? "완료" : "미완료"}</span>
                <span>최근 로그인: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("ko-KR") : "-"}</span>
              </p>
              <p className="meta">
                <span>ID: {user.id}</span>
              </p>
              <div className="actions">
                <button
                  disabled={workingUserId === user.id}
                  onClick={() => void toggleConfirm(user)}
                  type="button"
                >
                  {user.email_confirmed_at ? "인증 해제" : "인증 처리"}
                </button>
                <button
                  className="danger-btn"
                  disabled={workingUserId === user.id}
                  onClick={() => void deleteUser(user)}
                  type="button"
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
          {!loading && users.length === 0 ? <p>사용자가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
