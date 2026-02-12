import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DocumentListItem, DocumentRow } from "@/lib/types";

const db = () => getSupabaseAdmin();

const displayTitle = (row: Pick<DocumentRow, "title" | "user_title">) => row.user_title ?? row.title;

export const estimateReadingMinutes = (markdown: string) => {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

const normalizeTagNames = (names: string[]) =>
  [...new Set(names.map((v) => v.trim().toLowerCase()).filter(Boolean))];

export const createImportJob = async (url: string) => {
  const { data, error } = await db()
    .from("import_jobs")
    .insert({ url, status: "queued", progress: 0 })
    .select("id,status")
    .single();

  if (error) throw error;
  return data as { id: string; status: string };
};

export const updateImportJob = async (
  id: string,
  patch: { status?: string; progress?: number; document_id?: string | null; error_message?: string | null }
) => {
  const { error } = await db().from("import_jobs").update(patch).eq("id", id);
  if (error) throw error;
};

export const createDocument = async (input: {
  source_url: string;
  canonical_url?: string | null;
  source_domain?: string | null;
  title: string;
  user_title?: string | null;
  excerpt?: string | null;
  content_markdown: string;
  content_html?: string | null;
  author?: string | null;
  published_at?: string | null;
  language?: string;
  content_hash?: string;
}) => {
  const { data, error } = await db()
    .from("documents")
    .insert({
      source_url: input.source_url,
      canonical_url: input.canonical_url ?? null,
      source_domain: input.source_domain ?? null,
      title: input.title,
      user_title: input.user_title ?? null,
      excerpt: input.excerpt ?? null,
      content_markdown: input.content_markdown,
      content_html: input.content_html ?? null,
      author: input.author ?? null,
      published_at: input.published_at ?? null,
      language: input.language ?? "ko",
      reading_minutes: estimateReadingMinutes(input.content_markdown),
      content_hash: input.content_hash ?? null,
      status: "ready"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
};

export const createCapture = async (input: {
  document_id: string;
  raw_html?: string | null;
  cleaned_html?: string | null;
  extractor: string;
  extractor_version?: string | null;
  extract_score?: number | null;
  error_message?: string | null;
}) => {
  const { error } = await db().from("captures").insert(input);
  if (error) throw error;
};

type DocumentListQuery = {
  q?: string;
  tag?: string;
  folderId?: string;
  status?: string;
  sort?: "created_at" | "title";
  order?: "asc" | "desc";
  page: number;
  limit: number;
};

export const listDocuments = async (query: DocumentListQuery) => {
  const from = (query.page - 1) * query.limit;
  const to = from + query.limit - 1;

  let builder = db()
    .from("documents")
    .select(
      "id,source_url,source_domain,title,user_title,excerpt,content_markdown,content_html,reading_minutes,status,created_at,updated_at",
      { count: "exact" }
    )
    .range(from, to);

  if (query.status) builder = builder.eq("status", query.status);
  if (query.q) builder = builder.textSearch("search_vector", query.q, { type: "websearch" });

  const sort = query.sort ?? "created_at";
  const ascending = query.order === "asc";
  builder = builder.order(sort, { ascending });

  const { data, error, count } = await builder;
  if (error) throw error;

  const rows = (data ?? []) as DocumentRow[];
  const ids = rows.map((r) => r.id);
  const tagMap = await getTagNamesByDocumentIds(ids);
  const folderMap = await getFolderIdsByDocumentIds(ids);

  let items: DocumentListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    display_title: displayTitle(row),
    source_url: row.source_url,
    source_domain: row.source_domain,
    excerpt: row.excerpt,
    tags: tagMap.get(row.id) ?? [],
    folder_ids: folderMap.get(row.id) ?? [],
    status: row.status,
    created_at: row.created_at
  }));

  if (query.tag) {
    const normalized = query.tag.trim().toLowerCase();
    items = items.filter((item) => item.tags.some((tag) => tag.toLowerCase() === normalized));
  }
  if (query.folderId) {
    items = items.filter((item) => item.folder_ids.includes(query.folderId as string));
  }

  return { items, total: count ?? items.length };
};

export const getDocumentById = async (id: string) => {
  const { data, error } = await db()
    .from("documents")
    .select(
      "id,source_url,source_domain,title,user_title,excerpt,content_markdown,content_html,reading_minutes,status,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [tags, folderIds] = await Promise.all([getTagNamesByDocumentIds([id]), getFolderIdsByDocumentIds([id])]);
  const row = data as DocumentRow;

  return {
    ...row,
    display_title: displayTitle(row),
    tags: tags.get(id) ?? [],
    folder_ids: folderIds.get(id) ?? []
  };
};

export const updateDocument = async (
  id: string,
  input: {
    user_title?: string | null;
    content_markdown?: string;
    tags?: string[];
    folder_ids?: string[];
  }
) => {
  const patch: Record<string, unknown> = {};
  if (input.user_title !== undefined) patch.user_title = input.user_title;
  if (input.content_markdown !== undefined) {
    patch.content_markdown = input.content_markdown;
    patch.reading_minutes = estimateReadingMinutes(input.content_markdown);
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await db().from("documents").update(patch).eq("id", id);
    if (error) throw error;
  }

  if (input.tags) {
    await replaceDocumentTags(id, input.tags);
  }
  if (input.folder_ids) {
    await replaceDocumentFolders(id, input.folder_ids);
  }

  return getDocumentById(id);
};

export const deleteDocument = async (id: string) => {
  const { error } = await db().from("documents").delete().eq("id", id);
  if (error) throw error;
};

export const getJobById = async (id: string) => {
  const { data, error } = await db()
    .from("import_jobs")
    .select("id,url,status,progress,document_id,error_message,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const listTags = async () => {
  const { data, error } = await db().from("tags").select("id,name,color,created_at").order("name");
  if (error) throw error;
  return data ?? [];
};

export const createTag = async (name: string, color?: string) => {
  const { data, error } = await db()
    .from("tags")
    .insert({ name: name.trim().toLowerCase(), color: color ?? "#4A5568" })
    .select("id,name,color,created_at")
    .single();
  if (error) throw error;
  return data;
};

export const deleteTag = async (id: string) => {
  const { error } = await db().from("tags").delete().eq("id", id);
  if (error) throw error;
};

export const listFolders = async () => {
  const { data, error } = await db()
    .from("folders")
    .select("id,name,description,created_at")
    .order("name");
  if (error) throw error;
  return data ?? [];
};

export const createFolder = async (name: string, description?: string) => {
  const { data, error } = await db()
    .from("folders")
    .insert({ name, description: description ?? null })
    .select("id,name,description,created_at")
    .single();
  if (error) throw error;
  return data;
};

export const updateFolder = async (id: string, patch: { name?: string; description?: string | null }) => {
  const { data, error } = await db()
    .from("folders")
    .update(patch)
    .eq("id", id)
    .select("id,name,description,created_at")
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const deleteFolder = async (id: string) => {
  const { error } = await db().from("folders").delete().eq("id", id);
  if (error) throw error;
};

const getTagNamesByDocumentIds = async (ids: string[]) => {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;

  const { data, error } = await db()
    .from("document_tags")
    .select("document_id,tags(name)")
    .in("document_id", ids);
  if (error) throw error;

  for (const row of data ?? []) {
    const key = row.document_id as string;
    const entry = map.get(key) ?? [];
    const linked = row.tags as { name?: string } | { name?: string }[] | null;
    if (Array.isArray(linked)) {
      linked.forEach((item) => {
        if (item?.name) entry.push(item.name);
      });
    } else if (linked?.name) {
      entry.push(linked.name);
    }
    map.set(key, entry);
  }
  return map;
};

const getFolderIdsByDocumentIds = async (ids: string[]) => {
  const map = new Map<string, string[]>();
  if (ids.length === 0) return map;

  const { data, error } = await db().from("document_folders").select("document_id,folder_id").in("document_id", ids);
  if (error) throw error;

  for (const row of data ?? []) {
    const key = row.document_id as string;
    const entry = map.get(key) ?? [];
    if (row.folder_id) entry.push(row.folder_id as string);
    map.set(key, entry);
  }
  return map;
};

export const replaceDocumentFolders = async (documentId: string, folderIds: string[]) => {
  const normalized = [...new Set(folderIds)];
  const { error: delError } = await db().from("document_folders").delete().eq("document_id", documentId);
  if (delError) throw delError;

  if (normalized.length === 0) return;
  const rows = normalized.map((folderId) => ({ document_id: documentId, folder_id: folderId }));
  const { error } = await db().from("document_folders").insert(rows);
  if (error) throw error;
};

export const replaceDocumentTags = async (documentId: string, tagNames: string[]) => {
  const normalized = normalizeTagNames(tagNames);

  const { error: delError } = await db().from("document_tags").delete().eq("document_id", documentId);
  if (delError) throw delError;
  if (normalized.length === 0) return;

  const { data: existing, error: existingError } = await db().from("tags").select("id,name").in("name", normalized);
  if (existingError) throw existingError;

  const existingMap = new Map((existing ?? []).map((t) => [t.name as string, t.id as string]));
  const missing = normalized.filter((name) => !existingMap.has(name));

  if (missing.length > 0) {
    const insertRows = missing.map((name) => ({ name }));
    const { data: inserted, error: insertError } = await db().from("tags").insert(insertRows).select("id,name");
    if (insertError) throw insertError;
    for (const row of inserted ?? []) {
      existingMap.set(row.name as string, row.id as string);
    }
  }

  const mappingRows = normalized.map((name) => ({
    document_id: documentId,
    tag_id: existingMap.get(name) as string
  }));

  const { error } = await db().from("document_tags").insert(mappingRows);
  if (error) throw error;
};

