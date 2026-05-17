import type { BackendWorkerSnapshot, BackendWorkerTickResult, FreezeReturnDecision, QueueAction } from "@/lib/types";
import { runFreezeReturnSweep } from "@/lib/server/freeze-sweep";
import { createSchedulePlan } from "@/lib/server/schedule-planner";

export function runBackendWorkerTick(snapshot: BackendWorkerSnapshot): BackendWorkerTickResult {
  const schedule = createSchedulePlan({
    now: snapshot.now,
    items: [...snapshot.queueItems, ...snapshot.hiddenGoals],
    activeQueue: snapshot.activeQueue,
    timeLocks: snapshot.timeLocks,
    maxDealCards: 2
  });
  const freezeDecisions = runFreezeReturnSweep({
    now: snapshot.now,
    frozenTasks: snapshot.frozenTasks,
    currentQueue: snapshot.queueItems
  });
  const allActions = [...schedule.actions, ...freezeDecisions.map((decision) => decision.action)];
  const skippedActionIds: string[] = [];
  const actions = allActions.filter((action) => {
    if (snapshot.processedActionIds.includes(action.id)) {
      skippedActionIds.push(action.id);
      return false;
    }

    return true;
  });

  return {
    tickId: `worker-${snapshot.now.replaceAll(":", "-").replaceAll(".", "-").replace("Z", "")}`,
    generatedAt: snapshot.now,
    actions: dedupeActions(actions),
    skippedActionIds,
    schedule,
    freezeDecisions
  };
}

function dedupeActions(actions: QueueAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    if (seen.has(action.id)) {
      return false;
    }

    seen.add(action.id);
    return true;
  });
}

export type { FreezeReturnDecision };
