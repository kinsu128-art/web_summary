import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { createHash } from "node:crypto";
import {
  createCapture,
  createDocument,
  createImportJob,
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
  return `${compact.slice(0, max - 1)}…`;
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

  const images = Array.from(document.querySelectorAll("img"));
  for (const img of images) {
    img.removeAttribute("width");
    img.removeAttribute("height");
    img.removeAttribute("sizes");
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
  }

  return document.body.innerHTML;
};

const toMarkdown = (html: string) => turndown.turndown(html).trim();

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const fetchHtml = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status}`);
  }
  return await response.text();
};

export const runImportDocument = async (input: ImportInput) => {
  const job = await createImportJob(input.url);

  try {
    await updateImportJob(job.id, { status: "fetching", progress: 15, error_message: null });
    const rawHtml = await fetchHtml(input.url);

    await updateImportJob(job.id, { status: "extracting", progress: 45 });
    const dom = new JSDOM(rawHtml, { url: input.url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article?.content) {
      throw new Error("Could not extract readable content");
    }

    const normalizedHtml = normalizeContentImages(article.content, input.url);
    const markdown = toMarkdown(normalizedHtml);
    if (!markdown) {
      throw new Error("Extracted content is empty");
    }

    const language = dom.window.document.documentElement.lang?.trim() || "ko";
    const finalTitle = trimText(article.title, 180) ?? "Untitled";

    await updateImportJob(job.id, { status: "saving", progress: 75 });
    const document = await createDocument({
      source_url: input.url,
      canonical_url: input.url,
      source_domain: normalizeDomain(input.url),
      title: finalTitle,
      user_title: input.title?.trim() || null,
      excerpt: trimText(article.excerpt),
      content_markdown: markdown,
      content_html: normalizedHtml,
      author: trimText(article.byline, 120),
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
      await replaceDocumentTags(document.id, input.tags);
    }
    if (input.folder_ids && input.folder_ids.length > 0) {
      await replaceDocumentFolders(document.id, input.folder_ids);
    }

    await updateImportJob(job.id, {
      status: "done",
      progress: 100,
      document_id: document.id,
      error_message: null
    });

    return { job_id: job.id, status: "done", document_id: document.id };
  } catch (error) {
    await updateImportJob(job.id, {
      status: "failed",
      progress: 100,
      error_message: error instanceof Error ? error.message : "Import failed"
    });
    throw error;
  }
};
