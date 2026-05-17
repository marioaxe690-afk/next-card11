import { NextResponse } from "next/server";
import { backendPorts } from "@/lib/server/backend-services";
import { dispatchProviderActions } from "@/lib/server/provider-dispatch";
import type { BackendWorkerSnapshot } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<BackendWorkerSnapshot> | null;
  const now = body?.now ?? new Date().toISOString();
  const snapshot = body?.queueItems
    ? ({
        now,
        queueItems: body.queueItems,
        activeQueue: body.activeQueue ?? [],
        timeLocks: body.timeLocks ?? [],
        frozenTasks: body.frozenTasks ?? [],
        hiddenGoals: body.hiddenGoals ?? [],
        processedActionIds: body.processedActionIds ?? []
      } satisfies BackendWorkerSnapshot)
    : await backendPorts.queueRepository.readSnapshot(now);
  const result = await backendPorts.worker.tick(snapshot);
  const dispatchResults = await dispatchProviderActions(result.actions, backendPorts);

  await backendPorts.queueRepository.writeSnapshot(snapshot);
  await backendPorts.queueRepository.markActionsProcessed(result.actions);

  return NextResponse.json({ ...result, dispatchResults });
}
