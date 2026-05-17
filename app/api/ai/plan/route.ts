import { NextResponse } from "next/server";
import { createCompatPlanningBundle } from "@/lib/server/compat-ai-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.inputs) {
    return NextResponse.json({ error: "inputs is required" }, { status: 400 });
  }

  const bundle = await createCompatPlanningBundle(body.inputs);
  return NextResponse.json(bundle);
}
