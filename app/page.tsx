"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type DocumentListItem = {
  id: string;
  title: string;
  display_title: string;
  source_url: string;
  source_domain: string | null;
  excerpt: string | null;
  tags: string[];
  folder_ids: string[];
  status: "ready" | "processing" | "failed" | "archived";
  created_at: string;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (query?.trim()) params.set("q", query.trim());

      const response = await fetch(`/api/v1/documents?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "문서 목록을 가져오지 못했습니다.");
      setDocs(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문서 목록을 가져오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const submitImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError("URL을 입력해 주세요.");
      return;
    }

    setIsImporting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          save_raw_html: false
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "가져오기에 실패했습니다.");

      setMessage("저장 완료: 목록을 갱신했습니다.");
      setUrl("");
      setTitle("");
      setTagsInput("");
      await fetchDocuments(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기에 실패했습니다.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <h1>web_summary</h1>
        <p>광고 없는 본문 학습 아카이브</p>
      </header>

      <section className="panel">
        <h2>새 문서 가져오기</h2>
        <form className="import-form" onSubmit={submitImport}>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
          </label>
          <div className="form-grid">
            <label>
              사용자 제목 (선택)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="직접 제목 지정" />
            </label>
            <label>
              태그 (쉼표 구분)
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, hooks" />
            </label>
          </div>
          <button disabled={isImporting} type="submit">
            {isImporting ? "가져오는 중..." : "정리 후 저장"}
          </button>
        </form>
        {message && <p className="notice ok">{message}</p>}
        {error && <p className="notice err">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>보관함</h2>
          <div className="search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목/본문 검색"
              onKeyDown={(e) => e.key === "Enter" && void fetchDocuments(q)}
            />
            <button onClick={() => void fetchDocuments(q)} type="button">
              검색
            </button>
          </div>
        </div>

        {isLoading ? <p>불러오는 중...</p> : null}

        <div className="list">
          {docs.map((doc) => (
            <article key={doc.id} className="item">
              <div className="item-head">
                <h3>{doc.display_title}</h3>
                <span>{formatDate(doc.created_at)}</span>
              </div>
              <p className="excerpt">{doc.excerpt ?? "요약이 없습니다."}</p>
              <p className="meta">
                <span>{doc.source_domain ?? "unknown"}</span>
                <span>{doc.tags.length > 0 ? `#${doc.tags.join(" #")}` : "#untagged"}</span>
              </p>
              <div className="actions">
                <Link href={`/documents/${doc.id}`}>열람</Link>
                <a href={doc.source_url} rel="noreferrer" target="_blank">
                  원문
                </a>
              </div>
            </article>
          ))}
          {!isLoading && docs.length === 0 ? <p>저장된 문서가 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
