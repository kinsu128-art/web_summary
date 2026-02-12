"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type DocumentDetail = {
  id: string;
  title: string;
  user_title: string | null;
  display_title: string;
  source_url: string;
  content_markdown: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/documents/${id}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message ?? "문서를 불러오지 못했습니다.");
        setDoc(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "문서를 불러오지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [id]);

  return (
    <main className="shell">
      <section className="panel">
        <div className="panel-head">
          <h2>문서 상세</h2>
          <Link href="/">목록으로</Link>
        </div>
        {isLoading ? <p>불러오는 중...</p> : null}
        {error ? <p className="notice err">{error}</p> : null}
        {doc ? (
          <>
            <h1>{doc.display_title}</h1>
            <p className="meta">
              <span>{new Date(doc.created_at).toLocaleString("ko-KR")}</span>
              <span>{doc.tags.length > 0 ? `#${doc.tags.join(" #")}` : "#untagged"}</span>
            </p>
            <div className="actions">
              <a href={doc.source_url} rel="noreferrer" target="_blank">
                원문 보기
              </a>
            </div>
            <pre className="markdown">{doc.content_markdown}</pre>
          </>
        ) : null}
      </section>
    </main>
  );
}
