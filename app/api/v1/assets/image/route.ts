import { errorResponse } from "@/lib/http";

const resolveImageUrl = (url: string, ref?: string | null) => {
  const trimmed = url.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (ref) {
    try {
      return new URL(trimmed, ref).toString();
    } catch {
      return null;
    }
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get("url");
    const rawRef = searchParams.get("ref");

    if (!rawUrl) {
      return errorResponse("VALIDATION_ERROR", "Missing url query.", 400);
    }

    const targetUrl = resolveImageUrl(rawUrl, rawRef);
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return errorResponse("VALIDATION_ERROR", "Invalid image url.", 400);
    }

    const referer = rawRef ? new URL(rawRef).origin + "/" : undefined;
    const response = await fetch(targetUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        ...(referer ? { referer } : {})
      }
    });

    if (!response.ok || !response.body) {
      return errorResponse("INTERNAL_ERROR", "Failed to fetch source image.", 502, {
        status: response.status
      });
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return errorResponse("INTERNAL_ERROR", "Source is not an image.", 502, { contentType });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400"
      }
    });
  } catch (error) {
    return errorResponse("INTERNAL_ERROR", "Image proxy failed.", 500, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }
}
