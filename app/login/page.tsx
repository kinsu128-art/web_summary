"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type AuthMode = "login" | "signup";

const mapAuthErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("email logins are disabled")) {
    return "현재 Supabase에서 이메일 로그인이 비활성화되어 있습니다. Supabase Dashboard > Authentication > Providers > Email에서 로그인 기능을 활성화해 주세요.";
  }
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "이미 가입된 이메일입니다.";
  }
  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 인증 링크를 클릭한 뒤 다시 로그인해 주세요.";
  }
  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  return message;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const handleLogin = async () => {
    const supabase = getSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (signInError) throw signInError;

    setMessage("로그인되었습니다.");
    router.replace("/");
    router.refresh();
  };

  const handleSignup = async () => {
    const signupResponse = await fetch("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password })
    });

    if (!signupResponse.ok) {
      const body = (await signupResponse.json().catch(() => ({}))) as {
        error?: { message?: string; details?: { reason?: string } };
      };
      const messageText = body.error?.message ?? "회원가입 처리에 실패했습니다.";
      const reasonText = body.error?.details?.reason;
      throw new Error(reasonText ? `${messageText} (${reasonText})` : messageText);
    }

    await handleLogin();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "login") {
        await handleLogin();
      } else {
        await handleSignup();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.";
      setError(mapAuthErrorMessage(raw));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="shell">
      <section className="panel auth-panel">
        <h1>{mode === "login" ? "로그인" : "회원가입"}</h1>
        <p className="auth-desc">
          {mode === "login" ? "이메일로 로그인해 주세요." : "새 계정을 만들고 바로 로그인합니다."}
        </p>

        <div className="auth-switch">
          <button
            className={mode === "login" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("login")}
            type="button"
          >
            로그인
          </button>
          <button
            className={mode === "signup" ? "auth-tab active" : "auth-tab"}
            onClick={() => setMode("signup")}
            type="button"
          >
            회원가입
          </button>
        </div>

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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              type="password"
              value={password}
            />
          </label>
          <button disabled={isLoading} type="submit">
            {isLoading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        {message ? <p className="notice ok">{message}</p> : null}
        {error ? <p className="notice err">{error}</p> : null}

        <p className="auth-help">
          <Link href="/">메인으로 돌아가기</Link>
        </p>
      </section>
    </main>
  );
}
