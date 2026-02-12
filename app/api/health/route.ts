import { ok } from "@/lib/http";

export async function GET() {
  return ok({
    ok: true,
    service: "web_summary",
    timestamp: new Date().toISOString()
  });
}
