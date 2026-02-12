import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { createHash } from "node:crypto";
import {
  createCapture,
  createDocument,
  createImportJob,
  getDocumentSourceById,
  getDocumentById,
  overwriteDocumentFromExtraction,
  replaceDocumentFolders,
  replaceDocumentTags,
  updateImportJob
} from "@/lib/repositories/archive";

type ImportInput = {
  url: string;
  title?: string;
  tags?: string[];
  folder_ids?: string[];
  save_raw_html?: boolean;
};

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced"
});
turndown.use(gfm);

const trimText = (value: string | null | undefined, max = 280) => {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 3)}...`;
};

const normalizeDomain = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const normalizeContentImages = (html: string, baseUrl: string) => {
  const dom = new JSDOM(`<body>${html}</body>`, { url: baseUrl });
  const { document } = dom.window;

  const resolveImageSource = (img: HTMLImageElement) => {
    const candidates = [
      img.getAttribute("src"),
      img.getAttribute("data-src"),
      img.getAttribute("data-original"),
      img.getAttribute("data-lazy-src"),
      img.getAttribute("data-lazyload"),
      img.getAttribute("data-url")
    ].filter((v): v is string => Boolean(v && v.trim()));

    const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
    if (srcset) {
      const first = srcset
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => v.split(/\s+/)[0])
        .find(Boolean);
      if (first) candidates.push(first);
    }

    const picked = candidates.find(Boolean);
    if (!picked) return null;

    const trimmed = picked.trim();
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    try {
      return new URL(trimmed, baseUrl).toString();
    } catch {
      return null;
    }
  };

  const images = Array.from(document.querySelectorAll("img"));
  for (const img of images) {
    const absoluteSrc = resolveImageSource(img);
    if (absoluteSrc) {
      img.setAttribute("src", absoluteSrc);
    }

    img.removeAttribute("width");
    img.removeAttribute("height");
    img.removeAttribute("sizes");
    img.removeAttribute("srcset");
    img.removeAttribute("data-src");
    img.removeAttribute("data-original");
    img.removeAttribute("data-lazy-src");
    img.removeAttribute("data-lazyload");
    img.removeAttribute("data-srcset");
    img.removeAttribute("loading");
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
  }

  return document.body.innerHTML;
};

const normalizeCellText = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\|/g, "\\|");

const htmlTableToMarkdown = (tableHtml: string) => {
  const dom = new JSDOM(`<body>${tableHtml}</body>`);
  const table = dom.window.document.querySelector("table");
  if (!table) return "";

  const allRows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) => normalizeCellText(cell.textContent ?? ""))
  );

  const meaningfulRows = allRows.filter((row) => row.some((cell) => cell.length > 0));
  if (meaningfulRows.length === 0) return "";

  const hasThead = table.querySelector("thead tr") !== null;
  const firstRowCells = meaningfulRows[0];
  const firstRowIsHeader = firstRowCells.length > 0 && hasThead;
  const columnCount = meaningfulRows.reduce((max, row) => Math.max(max, row.length), firstRowCells.length);
  if (columnCount === 0) return "";

  const padRow = (row: string[]) => {
    const padded = [...row];
    while (padded.length < columnCount) padded.push("");
    return padded.slice(0, columnCount);
  };

  let header = firstRowIsHeader
    ? padRow(firstRowCells)
    : Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);

  if (header.every((cell) => cell.length === 0)) {
    header = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  }

  const bodyRows = firstRowIsHeader ? meaningfulRows.slice(1).map(padRow) : meaningfulRows.map(padRow);

  const renderRow = (row: string[]) => `| ${row.join(" | ")} |`;
  const separator = `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`;

  return [renderRow(header), separator, ...bodyRows.map(renderRow)].join("\n");
};

const convertHtmlTablesInMarkdown = (markdown: string) =>
  markdown.replace(/<table[\s\S]*?<\/table>/gi, (tableBlock) => {
    const tableMarkdown = htmlTableToMarkdown(tableBlock);
    return tableMarkdown ? `\n\n${tableMarkdown}\n\n` : "";
  });

const toMarkdown = (html: string) => {
  const markdown = turndown.turndown(html).trim();
  return convertHtmlTablesInMarkdown(markdown).trim();
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const fetchHtml = async (url: string) => {
  const target = new URL(url).toString();
  const origin = new URL(target).origin;
  const response = await fetch(target, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      referer: `${origin}/`,
      "cache-control": "no-cache"
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const excerpt = text.replace(/\s+/g, " ").slice(0, 180);
    throw new Error(
      `Fetch failed with status ${response.status}${excerpt ? `: ${excerpt}` : ""}`
    );
  }
  return await response.text();
};

type ExtractedArticle = {
  content: string;
  title: string | null;
  excerpt: string | null;
  byline: string | null;
};

type ReaderFallback = {
  title: string | null;
  markdown: string;
  excerpt: string | null;
};

const extractWithFallback = (rawHtml: string, url: string): ExtractedArticle => {
  const dom = new JSDOM(rawHtml, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (article?.content) {
    return {
      content: article.content,
      title: article.title ?? null,
      excerpt: article.excerpt ?? null,
      byline: article.byline ?? null
    };
  }

  const doc = dom.window.document;
  const selectors = [
    "article",
    "main article",
    ".post-content",
    ".entry-content",
    ".article-content",
    ".content",
    "main",
    "#content"
  ];

  for (const selector of selectors) {
    const candidates = Array.from(doc.querySelectorAll(selector));
    for (const node of candidates) {
      const textLength = (node.textContent ?? "").replace(/\s+/g, " ").trim().length;
      if (textLength < 200) continue;
      return {
        content: node.innerHTML,
        title: doc.title || null,
        excerpt: (node.querySelector("p")?.textContent ?? "").trim().slice(0, 280) || null,
        byline: null
      };
    }
  }

  throw new Error("Could not extract readable content");
};

const fetchMarkdownWithReaderFallback = async (url: string): Promise<ReaderFallback> => {
  const normalized = new URL(url).toString();
  const readerUrl = `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, "")}`;

  const response = await fetch(readerUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept: "text/plain,text/markdown;q=0.9,*/*;q=0.8"
    }
  });
  if (!response.ok) {
    throw new Error(`Reader fallback failed with status ${response.status}`);
  }

  const raw = (await response.text()).trim();
  if (!raw) throw new Error("Reader fallback returned empty content");

  const titleMatch = raw.match(/^Title:\s*(.+)$/m);
  const marker = "Markdown Content:";
  const idx = raw.indexOf(marker);
  const markdown = (idx >= 0 ? raw.slice(idx + marker.length) : raw).trim();
  if (markdown.length < 80) throw new Error("Reader fallback content too short");

  const excerpt = markdown
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  return {
    title: titleMatch?.[1]?.trim() ?? null,
    markdown,
    excerpt: excerpt || null
  };
};

export const runImportDocument = async (userId: string, input: ImportInput) => {
  const job = await createImportJob(userId, input.url);

  try {
    await updateImportJob(userId, job.id, { status: "fetching", progress: 15, error_message: null });
    const rawHtml = await fetchHtml(input.url);

    await updateImportJob(userId, job.id, { status: "extracting", progress: 45 });
    const dom = new JSDOM(rawHtml, { url: input.url });
    const language = dom.window.document.documentElement.lang?.trim() || "ko";

    let normalizedHtml: string | null = null;
    let markdown = "";
    let derivedTitle: string | null = null;
    let derivedExcerpt: string | null = null;
    let derivedAuthor: string | null = null;

    try {
      const article = extractWithFallback(rawHtml, input.url);
      normalizedHtml = normalizeContentImages(article.content, input.url);
      markdown = toMarkdown(normalizedHtml);
      derivedTitle = article.title ?? null;
      derivedExcerpt = article.excerpt ?? null;
      derivedAuthor = article.byline ?? null;
    } catch {
      const reader = await fetchMarkdownWithReaderFallback(input.url);
      markdown = reader.markdown;
      derivedTitle = reader.title;
      derivedExcerpt = reader.excerpt;
      derivedAuthor = null;
    }
    if (!markdown) throw new Error("Extracted content is empty");

    const finalTitle = trimText(derivedTitle, 180) ?? "Untitled";

    await updateImportJob(userId, job.id, { status: "saving", progress: 75 });
    const document = await createDocument({
      user_id: userId,
      source_url: input.url,
      canonical_url: input.url,
      source_domain: normalizeDomain(input.url),
      title: finalTitle,
      user_title: input.title?.trim() || null,
      excerpt: trimText(derivedExcerpt),
      content_markdown: markdown,
      content_html: normalizedHtml,
      author: trimText(derivedAuthor, 120),
      language,
      content_hash: sha256(markdown)
    });

    await createCapture({
      document_id: document.id,
      raw_html: input.save_raw_html ? rawHtml : null,
      cleaned_html: normalizedHtml,
      extractor: "readability",
      extractor_version: "mozilla/readability",
      extract_score: null,
      error_message: null
    });

    if (input.tags && input.tags.length > 0) {
      await replaceDocumentTags(userId, document.id, input.tags);
    }
    if (input.folder_ids && input.folder_ids.length > 0) {
      await replaceDocumentFolders(userId, document.id, input.folder_ids);
    }

    await updateImportJob(userId, job.id, {
      status: "done",
      progress: 100,
      document_id: document.id,
      error_message: null
    });

    return { job_id: job.id, status: "done", document_id: document.id };
  } catch (error) {
    await updateImportJob(userId, job.id, {
      status: "failed",
      progress: 100,
      error_message: error instanceof Error ? error.message : "Import failed"
    });
    throw error;
  }
};

export const rerunExtractionForDocument = async (userId: string, documentId: string) => {
  const source = await getDocumentSourceById(userId, documentId);
  if (!source) {
    throw new Error("Document not found");
  }

  const job = await createImportJob(userId, source.source_url);

  try {
    await updateImportJob(userId, job.id, {
      status: "fetching",
      progress: 15,
      error_message: null
    });
    const rawHtml = await fetchHtml(source.source_url);

    await updateImportJob(userId, job.id, { status: "extracting", progress: 45 });
    const dom = new JSDOM(rawHtml, { url: source.source_url });
    const language = dom.window.document.documentElement.lang?.trim() || "ko";

    let normalizedHtml: string | null = null;
    let markdown = "";
    let derivedTitle: string | null = null;
    let derivedExcerpt: string | null = null;
    let derivedAuthor: string | null = null;

    try {
      const article = extractWithFallback(rawHtml, source.source_url);
      normalizedHtml = normalizeContentImages(article.content, source.source_url);
      markdown = toMarkdown(normalizedHtml);
      derivedTitle = article.title ?? null;
      derivedExcerpt = article.excerpt ?? null;
      derivedAuthor = article.byline ?? null;
    } catch {
      const reader = await fetchMarkdownWithReaderFallback(source.source_url);
      markdown = reader.markdown;
      derivedTitle = reader.title;
      derivedExcerpt = reader.excerpt;
      derivedAuthor = null;
    }
    if (!markdown) throw new Error("Extracted content is empty");

    const finalTitle = trimText(derivedTitle, 180) ?? "Untitled";

    await updateImportJob(userId, job.id, { status: "saving", progress: 75 });
    await overwriteDocumentFromExtraction(userId, documentId, {
      title: finalTitle,
      excerpt: trimText(derivedExcerpt),
      content_markdown: markdown,
      content_html: normalizedHtml,
      author: trimText(derivedAuthor, 120),
      language,
      content_hash: sha256(markdown),
      source_domain: normalizeDomain(source.source_url),
      canonical_url: source.source_url
    });

    await createCapture({
      document_id: documentId,
      raw_html: null,
      cleaned_html: normalizedHtml,
      extractor: "readability-reextract",
      extractor_version: "mozilla/readability",
      extract_score: null,
      error_message: null
    });

    await updateImportJob(userId, job.id, {
      status: "done",
      progress: 100,
      document_id: documentId,
      error_message: null
    });

    const updated = await getDocumentById(userId, documentId);
    return {
      job_id: job.id,
      status: "done",
      document_id: documentId,
      document: updated
    };
  } catch (error) {
    await updateImportJob(userId, job.id, {
      status: "failed",
      progress: 100,
      document_id: documentId,
      error_message: error instanceof Error ? error.message : "Re-extract failed"
    });
    throw error;
  }
};
