import { NextResponse } from "next/server";
import { toQueueAction, validateScheduleAction } from "@/lib/server/schedule-agent";
import type { AgentScheduleAction } from "@/lib/server/schedule-agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<AgentScheduleAction> | null;

  if (!body) {
    return NextResponse.json({ errors: ["body is required"] }, { status: 400 });
  }

  const validation = validateScheduleAction(body);

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const action = body as AgentScheduleAction;

  return NextResponse.json({
    action,
    validation,
    queueAction: toQueueAction(action)
  });
}
