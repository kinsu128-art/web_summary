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
type JobItem = {
  id: string;
  url: string;
  status: "queued" | "fetching" | "extracting" | "saving" | "done" | "failed";
  progress: number;
  document_id: string | null;
  error_message: string | null;
  created_at: string;
};

type SetupCheckItem = {
  table: string;
  ok: boolean;
  error: string | null;
};

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
  const [setupItems, setSetupItems] = useState<SetupCheckItem[]>([]);
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
        fetch("/api/v1/tags", { cache: "no-store" }),
        fetch("/api/v1/folders", { cache: "no-store" })
      ]);
      const tagsJson = await tagsRes.json();
      const foldersJson = await foldersRes.json();
      if (tagsRes.ok) setTags(Array.isArray(tagsJson.items) ? tagsJson.items : []);
      if (foldersRes.ok) setFolders(Array.isArray(foldersJson.items) ? foldersJson.items : []);
    } catch {
      // keep UI usable even if meta fetch fails
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/jobs?limit=12", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setJobsError(data?.error?.message ?? "Failed to load jobs.");
        return;
      }
      setJobsError(null);
      setJobs(Array.isArray(data.items) ? data.items : []);
    } catch {
      setJobsError("Failed to load jobs.");
    }
  }, []);

  const fetchSetup = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/system/setup", { cache: "no-store" });
      const data = await response.json();
      const details = data?.error?.details;

      if (response.ok) {
        setSetupOk(true);
        setSetupMessage("Supabase setup is healthy.");
        setSetupItems(Array.isArray(data?.tables) ? data.tables : []);
        return;
      }

      setSetupOk(false);
      setSetupMessage(data?.error?.message ?? "Supabase setup check failed.");
      setSetupItems(Array.isArray(details?.tables) ? details.tables : []);
    } catch {
      setSetupOk(false);
      setSetupMessage("Supabase setup check failed.");
      setSetupItems([]);
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

      const response = await fetch(`/api/v1/documents?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to load documents.");
      setDocs(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMeta();
    void fetchJobs();
    void fetchSetup();
    void fetchDocuments();
  }, [fetchDocuments, fetchJobs, fetchMeta, fetchSetup]);

  useEffect(() => {
    const hasRunning = jobs.some((job) => job.status !== "done" && job.status !== "failed");
    if (!hasRunning) return;
    const timer = window.setInterval(() => {
      void fetchJobs();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs, fetchJobs]);

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
          folder_ids: importFolderId ? [importFolderId] : undefined,
          save_raw_html: false
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Import failed.");

      setMessage("Saved successfully.");
      setUrl("");
      setTitle("");
      setTagsInput("");
      setImportFolderId("");
      await Promise.all([fetchDocuments(q, selectedTag, selectedFolder), fetchMeta(), fetchJobs()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
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
      const response = await fetch("/api/v1/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to create folder.");
      setNewFolderName("");
      setMessage("Folder created.");
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder.");
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
      const response = await fetch("/api/v1/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message ?? "Failed to create tag.");
      setNewTagName("");
      setMessage("Tag created.");
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create tag.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const removeTag = async (id: string) => {
    setDeletingTagId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/tags/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? "Failed to delete tag.");
      }
      setMessage("Tag deleted.");
      await Promise.all([fetchMeta(), fetchDocuments(q, selectedTag, selectedFolder)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete tag.");
    } finally {
      setDeletingTagId(null);
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
        <div className="panel-head">
          <h2>Supabase Setup Health</h2>
          <button onClick={() => void fetchSetup()} type="button">
            Check Again
          </button>
        </div>
        {setupMessage ? (
          <p className={`notice ${setupOk ? "ok" : "err"}`}>
            {setupMessage}
            {setupOk === false ? " Check Vercel env vars and Supabase migrations." : ""}
          </p>
        ) : null}
        {setupItems.length > 0 ? (
          <div className="setup-grid">
            {setupItems.map((item) => (
              <article key={item.table} className={`setup-item ${item.ok ? "pass" : "fail"}`}>
                <h3>{item.table}</h3>
                <p>{item.ok ? "ok" : item.error ?? "missing"}</p>
              </article>
            ))}
          </div>
        ) : null}
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
              Custom title (optional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My study title" />
            </label>
            <label>
              Tags (comma separated)
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="react, hooks" />
            </label>
          </div>
          <label>
            Folder (optional)
            <select value={importFolderId} onChange={(e) => setImportFolderId(e.target.value)}>
              <option value="">None</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={isImporting} type="submit">
            {isImporting ? "Importing..." : "Clean and Save"}
          </button>
        </form>
        <div className="inline-create">
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder name" />
          <button disabled={isCreatingFolder} onClick={createFolder} type="button">
            {isCreatingFolder ? "Creating..." : "Create Folder"}
          </button>
        </div>
        <div className="inline-create">
          <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="New tag name" />
          <button disabled={isCreatingTag} onClick={createTag} type="button">
            {isCreatingTag ? "Creating..." : "Create Tag"}
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
                title="Delete tag"
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
                <span>Progress: {job.progress}%</span>
                <span>{job.error_message ? `Error: ${job.error_message}` : "No error"}</span>
              </p>
              <div className="actions">
                {job.document_id ? <Link href={`/documents/${job.document_id}`}>Open Document</Link> : null}
              </div>
            </article>
          ))}
          {jobs.length === 0 ? <p>No jobs yet.</p> : null}
        </div>
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
