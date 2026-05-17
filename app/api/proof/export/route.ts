import { NextResponse } from "next/server";
import { exportProofJson, exportProofMarkdown } from "@/lib/server/proof-export";
import type { ProofExportPayload } from "@/lib/server/proof-export";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "markdown";
  const payload = normalizePayload(body);
  const output = format === "json" ? exportProofJson(payload) : exportProofMarkdown(payload);

  return new NextResponse(output, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8"
    }
  });
}

function normalizePayload(value: unknown): ProofExportPayload {
  const object = value && typeof value === "object" ? (value as Partial<ProofExportPayload>) : {};

  return {
    records: Array.isArray(object.records) ? object.records : [],
    rewardCards: Array.isArray(object.rewardCards) ? object.rewardCards : [],
    summaryDocument: typeof object.summaryDocument === "string" ? object.summaryDocument : ""
  };
}
