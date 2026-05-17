import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import type { QueueAction } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as QueueAction | null;

  if (!body?.id || !body.kind || !body.targetId) {
    return NextResponse.json({ error: "QueueAction is required" }, { status: 400 });
  }

  try {
    const result = await backendPorts.notifications.createOrUpdate(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { providerId: `web-push:${body.targetId}`, status: "failed", error: error instanceof Error ? error.message : "Push failed" },
      { status: 500 }
    );
  }
}
