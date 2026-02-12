"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const getSupabaseBrowserClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: true, autoRefreshToken: true } }
  );

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });
      if (signInError) throw signInError;

      setMessage("로그인에 성공했습니다.");
      router.push("/");
      router.refresh();
    } catch (err) {
      const text = err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
      setError(text);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1>로그인</h1>
        <p className="auth-desc">인수의 공부노트를 사용하려면 로그인해 주세요.</p>
        <form className="import-form" onSubmit={onSubmit}>
          <label>
            이메일
            <input
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>
          <label>
            비밀번호
            <input
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              type="password"
              value={password}
            />
          </label>
          <button disabled={isLoading} type="submit">
            {isLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        {message ? <p className="notice ok">{message}</p> : null}
        {error ? <p className="notice err">{error}</p> : null}
        <p className="auth-help">
          계정이 없다면 Supabase Authentication에서 사용자를 먼저 생성해 주세요.{" "}
          <Link href="/">메인으로 돌아가기</Link>
        </p>
      </section>
    </main>
  );
}
