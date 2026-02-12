"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(iso));

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [q, setQ] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [tagsRes, foldersRes] = await Promise.all([fetch("/api/v1/tags", { cache: "no-store" }), fetch("/api/v1/folders", { cache: "no-store" })]);
      const tagsJson = await tagsRes.json();
      const foldersJson = await foldersRes.json();
      if (tagsRes.ok) setTags(Array.isArray(tagsJson.items) ? tagsJson.items : []);
      if (foldersRes.ok) setFolders(Array.isArray(foldersJson.items) ? foldersJson.items : []);
    } catch {
      // keep UI usable even if meta fetch fails
    }
  }, []);

  const fetchDocuments = useCallback(
    async (query?: string, tag?: string, folderId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "30");
        if (query?.trim()) params.set("q", query.trim());
        if (tag?.trim()) params.set("tag", tag.trim());
        if (folderId?.trim()) params.set("folder_id", folderId.trim());

        const response = await fetch(`/api/v1/documents?${params.toString()}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message ?? "Failed to load documents.");
        setDocs(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load documents.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchMeta();
    void fetchDocuments();
  }, [fetchDocuments, fetchMeta]);

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
      setError("URL is required.");
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
      if (!response.ok) throw new Error(data?.error?.message ?? "Import failed.");

      setMessage("Saved successfully.");
      setUrl("");
      setTitle("");
      setTagsInput("");
      await fetchDocuments(q, selectedTag, selectedFolder);
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  const runSearch = () => void fetchDocuments(q, selectedTag, selectedFolder);

  return (
    <main className="shell">
      <header className="topbar">
        <h1>web_summary</h1>
        <p>Clean reading archive for study pages</p>
      </header>

      <section className="panel">
        <h2>Import URL</h2>
        <form className="import-form" onSubmit={submitImport}>
          <label>
            URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
          </label>
          <div className="form-grid">
            <label>
              Custom title (optional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My study title" />
            </label>
            <label>
              Tags (comma separated)
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, hooks" />
            </label>
          </div>
          <button disabled={isImporting} type="submit">
            {isImporting ? "Importing..." : "Clean and Save"}
          </button>
        </form>
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
              placeholder="Search title or content"
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
            />
            <button onClick={runSearch} type="button">
              Search
            </button>
          </div>
        </div>
        <div className="filter-row">
          <label>
            Tag
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              <option value="">All</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Folder
            <select value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
              <option value="">All</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <button onClick={runSearch} type="button">
            Apply Filters
          </button>
        </div>

        {isLoading ? <p>Loading...</p> : null}

        <div className="list">
          {docs.map((doc) => (
            <article key={doc.id} className="item">
              <div className="item-head">
                <h3>{doc.display_title}</h3>
                <span>{formatDate(doc.created_at)}</span>
              </div>
              <p className="excerpt">{doc.excerpt ?? "No excerpt."}</p>
              <p className="meta">
                <span>{doc.source_domain ?? "unknown"}</span>
                <span>{doc.tags.length > 0 ? `#${doc.tags.join(" #")}` : "#untagged"}</span>
              </p>
              <div className="actions">
                <Link href={`/documents/${doc.id}`}>Read</Link>
                <a href={doc.source_url} rel="noreferrer" target="_blank">
                  Source
                </a>
              </div>
            </article>
          ))}
          {!isLoading && docs.length === 0 ? <p>No documents yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
