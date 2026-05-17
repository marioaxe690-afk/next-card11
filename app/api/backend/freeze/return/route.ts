import { NextResponse } from "next/server";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";
import type { FrozenTaskEntry, QueueItem } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        now?: string;
        entry?: FrozenTaskEntry;
        currentQueue?: QueueItem[];
      }
    | null;

  if (!body?.entry) {
    return NextResponse.json({ error: "entry is required" }, { status: 400 });
  }

  const result = analyzeFrozenTaskReturn({
    now: body.now ?? new Date().toISOString(),
    entry: body.entry,
    currentQueue: body.currentQueue ?? []
  });

  return NextResponse.json(result);
}
