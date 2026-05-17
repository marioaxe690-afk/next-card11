import { NextResponse } from "next/server";
import { createCompatParsedInput } from "@/lib/server/compat-ai-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.kind || !body?.name) {
    return NextResponse.json({ error: "kind and name are required" }, { status: 400 });
  }

  const parsed = await createCompatParsedInput(body);
  return NextResponse.json(parsed);
}
