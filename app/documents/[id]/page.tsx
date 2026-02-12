"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocumentDetail = {
  id: string;
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
  const [editMode, setEditMode] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [markdownInput, setMarkdownInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/documents/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to load document.");

      setDoc(data);
      setTitleInput(data.user_title ?? "");
      setTagsInput((data.tags ?? []).join(", "));
      setMarkdownInput(data.content_markdown ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load document.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
      const response = await fetch(`/api/v1/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_title: titleInput.trim() ? titleInput.trim() : null,
          content_markdown: markdownInput,
          tags: parsedTags
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
