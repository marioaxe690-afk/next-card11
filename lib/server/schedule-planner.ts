import type { LockedConflict, QueueAction, QueueItem, SchedulePlannerInput, SchedulePlannerOutput } from "@/lib/types";
import { calculatePriorityVector, createQueueAction, getItemLocks, hasHardTimeLock } from "@/lib/server/priority-engine";

export function createSchedulePlan(input: SchedulePlannerInput): SchedulePlannerOutput {
  const maxDealCards = input.maxDealCards ?? 2;
  const items = input.items.filter((item) => item.status !== "completed");
  const priorityVectors = Object.fromEntries(
    items.map((item) => [item.id, calculatePriorityVector(item, input.now, input.timeLocks)])
  );
  const lockedConflicts = items.flatMap((item): LockedConflict[] =>
    getItemLocks(item, input.timeLocks)
      .filter((lock) => lock.strength === "hard" && !lock.canAgentMove)
      .map((lock) => ({
        targetId: item.id,
        lockId: lock.id,
        kind: lock.kind,
        reason: lock.reason,
        suggestedAction: lock.canAgentSuggest ? "suggest-only" : "keep-fixed"
      }))
  );
  const sortedUnlocked = [...items]
    .filter((item) => !hasHardTimeLock(item, input.timeLocks))
    .sort((left, right) => priorityVectors[right.id].score - priorityVectors[left.id].score);
  const orderedQueue = buildOrderedQueue(items, sortedUnlocked, input);
  const actions: QueueAction[] = [];
  let hiddenRevealCount = 0;

  for (const item of items) {
    const vector = priorityVectors[item.id];
    const hardLocked = hasHardTimeLock(item, input.timeLocks);

    if (item.hidden || item.kind === "hidden-goal") {
      if (vector.score >= 50 && hiddenRevealCount < maxDealCards) {
        hiddenRevealCount += 1;
        actions.push(
          createQueueAction({
            kind: "reveal-hidden-goal",
            targetId: item.id,
            title: item.title,
            priority: vector.score,
            now: input.now,
            reason: "隐藏未来目标到达触发窗口，先让用户 review，再决定是否入队。",
            requiresUserReview: true
          })
        );
      }
      continue;
    }

    if (!input.activeQueue.includes(item.id)) {
      actions.push(
        createQueueAction({
          kind: "insert-task",
          targetId: item.id,
          title: item.title,
          priority: vector.score,
          position: orderedQueue.indexOf(item.id),
          now: input.now,
          reason: hardLocked ? "任务带硬时间锁，只插入可见队列，不改时间。" : "新任务进入全局队列排序。"
        })
      );
    } else if (!hardLocked) {
      const before = input.activeQueue.indexOf(item.id);
      const after = orderedQueue.indexOf(item.id);

      if (after >= 0 && before !== after) {
        actions.push(
          createQueueAction({
            kind: "move-task",
            targetId: item.id,
            title: item.title,
            priority: vector.score,
            position: after,
            now: input.now,
            reason: "根据轻重缓急重新排序，但仅移动无硬锁任务。",
            payload: { before, after }
          })
        );
      }
    }

    if (item.reminderSync === "wanted" || vector.urgency >= 90) {
      actions.push(
        createQueueAction({
          kind: item.reminderSync === "synced" ? "update-reminder" : "create-reminder",
          targetId: item.id,
          title: item.title,
          priority: vector.score,
          scheduledFor: item.suggestedStartAt ?? item.deadlineAt ?? input.now,
          now: input.now,
          reason: "时间压力达到提醒阈值，需要后端通知动作。"
        })
      );
    }

    if (item.calendarSync === "wanted" || item.calendarSync === "synced") {
      actions.push(
        createQueueAction({
          kind: item.calendarSync === "synced" ? "update-calendar-event" : "create-calendar-event",
          targetId: item.id,
          title: item.title,
          priority: vector.score,
          scheduledFor: item.suggestedStartAt ?? item.deadlineAt ?? input.now,
          now: input.now,
          reason: hardLocked
            ? "日历事件带硬约束，只创建/确认事件，不静默改时间。"
            : item.calendarSync === "synced"
              ? "日历事件已存在，根据当前队列状态生成显式 update action。"
              : "用户要求同步日历，生成显式 calendar action。"
        })
      );
    }
  }

  const dealTargets = orderedQueue
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is QueueItem => Boolean(item))
    .filter((item) => !item.hidden && item.kind !== "hidden-goal" && item.status !== "frozen" && item.status !== "needs-review")
    .slice(0, maxDealCards);

  dealTargets.forEach((item, position) => {
    const vector = priorityVectors[item.id];
    actions.push(
      createQueueAction({
        kind: "deal-card",
        targetId: item.id,
        title: item.title,
        priority: vector.score,
        position,
        now: input.now,
        reason: position === 0 ? "当前最适合发出的第一张牌。" : "第二备选牌，保持 deck 只露出 1-2 张。"
      })
    );
  });

  return {
    generatedAt: input.now,
    priorityVectors,
    orderedQueue,
    actions: dedupeActions(actions),
    lockedConflicts
  };
}

function buildOrderedQueue(items: QueueItem[], sortedUnlocked: QueueItem[], input: SchedulePlannerInput) {
  const ordered: string[] = [];
  const lockedByPosition = new Map<number, QueueItem>();
  const maxLength = items.length;

  for (const item of items) {
    if (hasHardTimeLock(item, input.timeLocks)) {
      const position = item.position ?? input.activeQueue.indexOf(item.id);
      lockedByPosition.set(position >= 0 ? position : ordered.length, item);
    }
  }

  let unlockedIndex = 0;
  for (let index = 0; index < maxLength; index += 1) {
    const locked = lockedByPosition.get(index);

    if (locked) {
      ordered.push(locked.id);
      continue;
    }

    while (unlockedIndex < sortedUnlocked.length && ordered.includes(sortedUnlocked[unlockedIndex].id)) {
      unlockedIndex += 1;
    }

    const next = sortedUnlocked[unlockedIndex];
    if (next) {
      ordered.push(next.id);
      unlockedIndex += 1;
    }
  }

  for (const item of sortedUnlocked) {
    if (!ordered.includes(item.id)) {
      ordered.push(item.id);
    }
  }

  return ordered;
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
