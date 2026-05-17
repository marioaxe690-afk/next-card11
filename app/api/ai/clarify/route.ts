import { NextResponse } from "next/server";
import { createCompatClarificationTurn } from "@/lib/server/compat-ai-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.inputs || !Array.isArray(body?.messages)) {
    return NextResponse.json({ error: "inputs and messages are required" }, { status: 400 });
  }

  const result = await createCompatClarificationTurn({
    inputs: body.inputs,
    messages: body.messages
  });

  return NextResponse.json(result);
}
