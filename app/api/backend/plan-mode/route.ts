import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import type { PlanModeMessage, SourceType } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        inputText?: string;
        sourceType?: SourceType;
        parsedText?: string;
        messages?: PlanModeMessage[];
      }
    | null;

  if (!body || typeof body.inputText !== "string" || !body.inputText.trim()) {
    return NextResponse.json({ error: "inputText is required" }, { status: 400 });
  }

  const result = await backendPorts.aiPlanner.createPlanModeTurn({
    inputText: body.inputText,
    sourceType: body.sourceType ?? "text",
    parsedText: body.parsedText,
    messages: body.messages
  });

  return NextResponse.json(result);
}
