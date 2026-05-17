import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import type { SchedulePlannerInput } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<SchedulePlannerInput> | null;

  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items[] is required" }, { status: 400 });
  }

  const result = await backendPorts.schedulePlanner.plan({
    now: body.now ?? new Date().toISOString(),
    items: body.items,
    activeQueue: body.activeQueue ?? [],
    timeLocks: body.timeLocks ?? [],
    maxDealCards: body.maxDealCards ?? 2
  });

  return NextResponse.json(result);
}
