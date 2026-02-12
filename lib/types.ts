export type DocumentStatus = "ready" | "processing" | "failed" | "archived";
export type JobStatus = "queued" | "fetching" | "extracting" | "saving" | "done" | "failed";

export type DocumentRow = {
  id: string;
  source_url: string;
  source_domain: string | null;
  title: string;
  user_title: string | null;
  excerpt: string | null;
  content_markdown: string;
  content_html: string | null;
  reading_minutes: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
};

export type DocumentListItem = {
  id: string;
  title: string;
  display_title: string;
  source_url: string;
  source_domain: string | null;
  excerpt: string | null;
  tags: string[];
  folder_ids: string[];
  status: DocumentStatus;
  created_at: string;
};
