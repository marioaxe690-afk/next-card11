import type { FreezeReturnDecision, FrozenTaskEntry, QueueItem } from "@/lib/types";
import { analyzeFrozenTaskReturn } from "@/lib/server/freeze-return-agent";

export function runFreezeReturnSweep(input: {
  now: string;
  frozenTasks: FrozenTaskEntry[];
  currentQueue: QueueItem[];
}): FreezeReturnDecision[] {
  return input.frozenTasks.map((entry) =>
    analyzeFrozenTaskReturn({
      now: input.now,
      entry,
      currentQueue: input.currentQueue
    })
  );
}
