"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { authFetch } from "@/lib/supabase/auth-fetch";

type DocumentDetail = {
  id: string;
  user_title: string | null;
  display_title: string;
  source_url: string;
  content_markdown: string;
  tags: string[];
  folder_ids?: string[];
  created_at: string;
  updated_at: string;
};

type FolderItem = { id: string; name: string };

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [markdownInput, setMarkdownInput] = useState("");
  const [folderIdInput, setFolderIdInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReextracting, setIsReextracting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadFolders = useCallback(async () => {
    try {
      const response = await authFetch("/api/v1/folders", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && Array.isArray(data.items)) setFolders(data.items);
    } catch {
      // no-op
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/api/v1/documents/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to load document.");

      setDoc(data);
      setTitleInput(data.user_title ?? "");
      setTagsInput((data.tags ?? []).join(", "));
      setMarkdownInput(data.content_markdown ?? "");
      setFolderIdInput(data.folder_ids?.[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadFolders();
  }, [load, loadFolders]);

  const parsedTags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    [tagsInput]
  );

  const save = async () => {
    if (!id) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/api/v1/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_title: titleInput.trim() ? titleInput.trim() : null,
          content_markdown: markdownInput,
          tags: parsedTags,
          folder_ids: folderIdInput ? [folderIdInput] : []
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to save.");
      setDoc(data);
      setMessage("Saved.");
      setEditMode(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeDocument = async () => {
    if (!id) return;
    const confirmed = window.confirm("Delete this document?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await authFetch(`/api/v1/documents/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "Failed to delete.");
      }
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
      setIsDeleting(false);
    }
  };

  const reextractDocument = async () => {
    if (!id) return;
    setIsReextracting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/api/v1/documents/${id}/reextract`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to re-extract.");
      if (data?.document) {
        setDoc(data.document);
        setTitleInput(data.document.user_title ?? "");
        setTagsInput((data.document.tags ?? []).join(", "));
        setMarkdownInput(data.document.content_markdown ?? "");
      } else {
        await load();
      }
      setMessage("Re-extract completed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-extract.");
    } finally {
      setIsReextracting(false);
    }
  };

  const copyContent = async () => {
    if (!doc?.content_markdown) return;
    setIsCopying(true);
    setError(null);
    setMessage(null);
    try {
      await navigator.clipboard.writeText(doc.content_markdown);
      setMessage("내용을 복사했습니다.");
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <main className="shell">
      <section className="panel">
        <div className="panel-head">
          <h2>Document</h2>
          <div className="actions">
            <Link href="/">Back</Link>
            <button onClick={() => setEditMode((v) => !v)} type="button">
              {editMode ? "Cancel" : "Edit"}
            </button>
            <button disabled={isReextracting} onClick={reextractDocument} type="button">
              {isReextracting ? "Re-extracting..." : "Re-extract"}
            </button>
            <button className="danger-btn" disabled={isDeleting} onClick={removeDocument} type="button">
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
        {isLoading ? <p>Loading...</p> : null}
        {error ? <p className="notice err">{error}</p> : null}
        {message ? <p className="notice ok">{message}</p> : null}
        {doc ? (
          <>
            <h1>{doc.display_title}</h1>
            <p className="meta">
              <span>{new Date(doc.created_at).toLocaleString("ko-KR")}</span>
              <span>{doc.tags.length > 0 ? `#${doc.tags.join(" #")}` : "#untagged"}</span>
            </p>
            <div className="actions">
              <a href={doc.source_url} rel="noreferrer" target="_blank">
                Open Source
              </a>
              <button disabled={isCopying} onClick={copyContent} type="button">
                {isCopying ? "Copying..." : "내용 복사하기"}
              </button>
            </div>

            {editMode ? (
              <div className="editor">
                <label>
                  User title
                  <input value={titleInput} onChange={(e) => setTitleInput(e.target.value)} />
                </label>
                <label>
                  Tags (comma separated)
                  <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
                </label>
                <label>
                  Folder
                  <select value={folderIdInput} onChange={(e) => setFolderIdInput(e.target.value)}>
                    <option value="">None</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Markdown
                  <textarea rows={18} value={markdownInput} onChange={(e) => setMarkdownInput(e.target.value)} />
                </label>
                <button disabled={isSaving} onClick={save} type="button">
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            ) : (
              <article className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content_markdown}</ReactMarkdown>
              </article>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
