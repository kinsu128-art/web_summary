PRAGMA foreign_keys = ON;

-- documents: cleaned article archive
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  canonical_url TEXT,
  source_domain TEXT,
  title TEXT NOT NULL,
  user_title TEXT,
  excerpt TEXT,
  content_markdown TEXT NOT NULL,
  content_html TEXT,
  author TEXT,
  published_at TEXT,
  language TEXT NOT NULL DEFAULT 'ko',
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'failed', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_source_domain ON documents(source_domain);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

-- captures: extraction details and optional raw HTML
CREATE TABLE IF NOT EXISTS captures (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  raw_html TEXT,
  cleaned_html TEXT,
  extractor TEXT NOT NULL,
  extractor_version TEXT,
  extract_score REAL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_captures_document_id ON captures(document_id);

-- tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#4A5568',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags(tag_id);

-- folders
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_folders (
  document_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (document_id, folder_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_folders_folder_id ON document_folders(folder_id);

-- import jobs
CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'fetching', 'extracting', 'saving', 'done', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  document_id TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON import_jobs(created_at DESC);

-- full text search
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  title,
  content_markdown,
  excerpt,
  tokenize = 'unicode61'
);

CREATE TRIGGER IF NOT EXISTS trg_documents_ai AFTER INSERT ON documents
BEGIN
  INSERT INTO documents_fts(document_id, title, content_markdown, excerpt)
  VALUES (new.id, COALESCE(new.user_title, new.title), new.content_markdown, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_au AFTER UPDATE ON documents
BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
  INSERT INTO documents_fts(document_id, title, content_markdown, excerpt)
  VALUES (new.id, COALESCE(new.user_title, new.title), new.content_markdown, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS trg_documents_ad AFTER DELETE ON documents
BEGIN
  DELETE FROM documents_fts WHERE document_id = old.id;
END;

-- Keep updated_at fresh on update
CREATE TRIGGER IF NOT EXISTS trg_documents_touch_updated_at AFTER UPDATE ON documents
FOR EACH ROW
WHEN new.updated_at = old.updated_at
BEGIN
  UPDATE documents SET updated_at = datetime('now') WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_import_jobs_touch_updated_at AFTER UPDATE ON import_jobs
FOR EACH ROW
WHEN new.updated_at = old.updated_at
BEGIN
  UPDATE import_jobs SET updated_at = datetime('now') WHERE id = old.id;
END;
