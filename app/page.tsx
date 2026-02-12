"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { authFetch } from "@/lib/supabase/auth-fetch";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type DocumentListItem = {
  id: string;
  display_title: string;
  source_url: string;
  source_domain: string | null;
  excerpt: string | null;
  tags: string[];
  created_at: string;
};

type TagItem = { id: string; name: string };
type FolderItem = { id: string; name: string };
type JobItem = {
  id: string;
  url: string;
  status: "queued" | "fetching" | "extracting" | "saving" | "done" | "failed";
  progress: number;
  document_id: string | null;
  error_message: string | null;
  created_at: string;
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));

export default function HomePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAccountActionRunning, setIsAccountActionRunning] = useState(false);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [importFolderId, setImportFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [q, setQ] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [setupOk, setSetupOk] = useState<boolean | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [tagsRes, foldersRes] = await Promise.all([
        authFetch("/api/v1/tags", { cache: "no-store" }),
        authFetch("/api/v1/folders", { cache: "no-store" })
      ]);
      const tagsJson = await tagsRes.json();
      const foldersJson = await foldersRes.json();
      if (tagsRes.ok) setTags(Array.isArray(tagsJson.items) ? tagsJson.items : []);
      if (foldersRes.ok) setFolders(Array.isArray(foldersJson.items) ? foldersJson.items : []);
    } catch {
      // Keep UI usable even if metadata fetch fails.
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await authFetch("/api/v1/jobs?limit=3", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setJobsError(data?.error?.message ?? "작업 내역을 불러오지 못했습니다.");
        return;
      }
      setJobsError(null);
      setJobs(Array.isArray(data.items) ? data.items.slice(0, 3) : []);
    } catch {
      setJobsError("작업 내역을 불러오지 못했습니다.");
    }
  }, []);

  const fetchSetup = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/system/setup", { cache: "no-store" });
      if (response.ok) {
        setSetupOk(true);
        setSetupMessage("최종 상태: OK");
        return;
      }
      setSetupOk(false);
      setSetupMessage("최종 상태: FAIL");
    } catch {
      setSetupOk(false);
      setSetupMessage("최종 상태: FAIL");
    }
  }, []);

  const fetchDocuments = useCallback(async (query?: string, tag?: string, folderId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      if (query?.trim()) params.set("q", query.trim());
      if (tag?.trim()) params.set("tag", tag.trim());
      if (folderId?.trim()) params.set("folder_id", folderId.trim());

      const response = await authFetch(`/api/v1/documents?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "문서를 불러오지 못했습니다.");
      setDocs(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "문서를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        setAuthReady(true);
        setIsAuthed(false);
        router.replace("/login");
        return;
      }
      setIsAuthed(true);
      setAuthReady(true);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAuthed(false);
        setAuthReady(true);
        router.replace("/login");
        return;
      }
      setIsAuthed(true);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!authReady || !isAuthed) return;
    void fetchMeta();
    void fetchJobs();
    void fetchSetup();
    void fetchDocuments();
  }, [authReady, isAuthed, fetchDocuments, fetchJobs, fetchMeta, fetchSetup]);

  useEffect(() => {
    if (!authReady || !isAuthed) return;
    const hasRunning = jobs.some((job) => job.status !== "done" && job.status !== "failed");
    if (!hasRunning) return;
    const timer = window.setInterval(() => {
      void fetchJobs();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [authReady, isAuthed, jobs, fetchJobs]);

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const runSearch = () => void fetchDocuments(q, selectedTag, selectedFolder);

  const signOut = async () => {
    setIsAccountActionRunning(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그아웃에 실패했습니다.");
    } finally {
      setIsAccountActionRunning(false);
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm("정말 회원 탈퇴하시겠습니까? 저장된 계정은 복구되지 않습니다.");
    if (!confirmed) return;

    setIsAccountActionRunning(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/v1/auth/delete-account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ?? "회원 탈퇴 처리에 실패했습니다."
        );
      }

      await supabase.auth.signOut();
      router.replace("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "회원 탈퇴 처리에 실패했습니다.");
    } finally {
      setIsAccountActionRunning(false);
    }
  };

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
      const response = await authFetch("/api/v1/documents/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : undefined,
          folder_ids: importFolderId ? [importFolderId] : undefined,
          save_raw_html: false
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "가져오기에 실패했습니다.");

      setMessage("저장되었습니다.");
      setUrl("");
      setTitle("");
      setTagsInput("");
      setImportFolderId("");
      await Promise.all([fetchDocuments(q, selectedTag, selectedFolder), fetchMeta(), fetchJobs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "가져오기에 실패했습니다.");
      await fetchJobs();
    } finally {
      setIsImporting(false);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setIsCreatingFolder(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch("/api/v1/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "폴더 생성에 실패했습니다.");
      setNewFolderName("");
      setMessage("폴더를 만들었습니다.");
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "폴더 생성에 실패했습니다.");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreatingTag(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "태그 생성에 실패했습니다.");
      setNewTagName("");
      setMessage("태그를 만들었습니다.");
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "태그 생성에 실패했습니다.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const removeTag = async (id: string) => {
    setDeletingTagId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/api/v1/tags/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "태그 삭제에 실패했습니다.");
      }
      setMessage("태그를 삭제했습니다.");
      await Promise.all([fetchMeta(), fetchDocuments(q, selectedTag, selectedFolder)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "태그 삭제에 실패했습니다.");
    } finally {
      setDeletingTagId(null);
    }
  };

  if (!authReady || !isAuthed) {
    return (
      <main className="shell">
        <section className="panel auth-panel">
          <h2>로그인 확인 중...</h2>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <h1>인수의 공부노트</h1>
        <p>공부용 웹페이지를 깔끔하게 저장하는 아카이브</p>
        <div className="topbar-actions">
          <button disabled={isAccountActionRunning} onClick={signOut} type="button">
            로그아웃
          </button>
          <button className="danger-btn" disabled={isAccountActionRunning} onClick={deleteAccount} type="button">
            회원탈퇴
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel-head">
          <h2>Supabase Setup Health</h2>
          <button onClick={() => void fetchSetup()} type="button">
            Check Again
          </button>
        </div>
        {setupMessage ? <p className={`notice ${setupOk ? "ok" : "err"}`}>{setupMessage}</p> : null}
      </section>

      <section className="panel">
        <h2>Import URL</h2>
        <form className="import-form" onSubmit={submitImport}>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
          </label>
          <div className="form-grid">
            <label>
              사용자 제목 (선택)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="나만의 제목" />
            </label>
            <label>
              태그 (쉼표 구분)
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, hooks" />
            </label>
          </div>
          <label>
            폴더 (선택)
            <select value={importFolderId} onChange={(e) => setImportFolderId(e.target.value)}>
              <option value="">없음</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={isImporting} type="submit">
            {isImporting ? "가져오는 중..." : "정리해서 저장"}
          </button>
        </form>
        <div className="inline-create">
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="새 폴더 이름" />
          <button disabled={isCreatingFolder} onClick={createFolder} type="button">
            {isCreatingFolder ? "생성 중..." : "폴더 만들기"}
          </button>
        </div>
        <div className="inline-create">
          <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="새 태그 이름" />
          <button disabled={isCreatingTag} onClick={createTag} type="button">
            {isCreatingTag ? "생성 중..." : "태그 만들기"}
          </button>
        </div>
        {tags.length > 0 ? (
          <div className="chip-row">
            {tags.map((tag) => (
              <button
                key={tag.id}
                className="chip"
                disabled={deletingTagId === tag.id}
                onClick={() => void removeTag(tag.id)}
                title="태그 삭제"
                type="button"
              >
                #{tag.name} {deletingTagId === tag.id ? "..." : "x"}
              </button>
            ))}
          </div>
        ) : null}
        {message && <p className="notice ok">{message}</p>}
        {error && <p className="notice err">{error}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Archive</h2>
          <div className="search">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="제목 또는 내용 검색"
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <button onClick={runSearch} type="button">
              검색
            </button>
          </div>
        </div>
        <div className="filter-row">
          <label>
            태그
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="">전체</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            폴더
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
              <option value="">전체</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={runSearch} type="button">
            필터 적용
          </button>
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
                <Link href={`/documents/${doc.id}`}>읽기</Link>
                <a href={doc.source_url} rel="noreferrer" target="_blank">
                  원문
                </a>
              </div>
            </article>
          ))}
          {!isLoading && docs.length === 0 ? <p>저장된 문서가 없습니다.</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Recent Import Jobs</h2>
          <button onClick={() => void fetchJobs()} type="button">
            Refresh
          </button>
        </div>
        {jobsError ? <p className="notice err">{jobsError}</p> : null}
        <div className="list">
          {jobs.map((job) => (
            <article key={job.id} className="item">
              <div className="item-head">
                <h3>{job.status.toUpperCase()}</h3>
                <span>{formatDate(job.created_at)}</span>
              </div>
              <p className="excerpt">{job.url}</p>
              <p className="meta">
                <span>진행률: {job.progress}%</span>
                <span>{job.error_message ? `오류: ${job.error_message}` : "오류 없음"}</span>
              </p>
              <div className="actions">
                {job.document_id ? <Link href={`/documents/${job.document_id}`}>문서 열기</Link> : null}
              </div>
            </article>
          ))}
          {jobs.length === 0 ? <p>최근 작업이 없습니다.</p> : null}
        </div>
      </section>
    </main>
  );
}
