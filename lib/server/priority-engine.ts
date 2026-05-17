import type { PriorityVector, QueueAction, QueueActionKind, QueueItem, TimeLock } from "@/lib/types";

const stageUrgency: Record<QueueItem["urgencyStage"], number> = {
  calm: 24,
  warm: 48,
  hot: 78,
  burning: 94,
  expired: 100
};

export function clampPriority(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function minutesUntil(iso: string | null | undefined, now: Date) {
  if (!iso) {
    return null;
  }

  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
}

export function getItemLocks(item: QueueItem, globalLocks: TimeLock[]) {
  return [...item.timeLocks, ...globalLocks.filter((lock) => lock.targetId === item.id)];
}

export function hasHardTimeLock(item: QueueItem, globalLocks: TimeLock[]) {
  return getItemLocks(item, globalLocks).some((lock) => lock.strength === "hard" && !lock.canAgentMove);
}

export function calculatePriorityVector(item: QueueItem, nowInput: string | Date, globalLocks: TimeLock[] = []): PriorityVector {
  const now = typeof nowInput === "string" ? new Date(nowInput) : nowInput;
  const deadlineMinutes = minutesUntil(item.deadlineAt, now);
  const startMinutes = minutesUntil(item.suggestedStartAt, now);
  const behavior = item.behaviorVector;
  const hardLocks = getItemLocks(item, globalLocks).filter((lock) => lock.strength === "hard" && !lock.canAgentMove);
  const reasons: string[] = [];

  let deadlineRisk = 20;
  if (deadlineMinutes !== null) {
    if (deadlineMinutes <= 0) {
      deadlineRisk = 100;
      reasons.push("deadline 已经过期，需要 review 或重新安排。");
    } else if (deadlineMinutes <= 20) {
      deadlineRisk = 96;
      reasons.push("距离 deadline 不到 20 分钟。");
    } else if (deadlineMinutes <= 60) {
      deadlineRisk = 84;
      reasons.push("距离 deadline 不到 1 小时。");
    } else if (deadlineMinutes <= 180) {
      deadlineRisk = 66;
      reasons.push("今天内有明显截止压力。");
    } else if (deadlineMinutes <= 1440) {
      deadlineRisk = 52;
      reasons.push("24 小时内有截止窗口。");
    } else {
      deadlineRisk = 34;
    }
  }

  const startPressure = startMinutes !== null && startMinutes <= 0 ? 18 : startMinutes !== null && startMinutes <= 30 ? 12 : 0;
  const urgency = clampPriority(Math.max(stageUrgency[item.urgencyStage], deadlineRisk) + startPressure);
  const importance = clampPriority(
    behavior?.taskValue ??
      (item.kind === "calendar-event" ? 74 : item.kind === "hidden-goal" ? 62 : item.source === "attachment" ? 68 : 56)
  );
  const effort = clampPriority((item.estimatedMinutes / 60) * 100);
  const confidence = clampPriority(behavior?.expectancy ?? (item.kind === "calendar-event" ? 78 : 62));
  const timePressure = clampPriority(behavior?.timePressure ?? urgency);
  const procrastinationRisk = clampPriority(behavior?.procrastination ?? (item.status === "frozen" ? 66 : 36));
  const freezeAge = item.frozenAt
    ? clampPriority(((now.getTime() - new Date(item.frozenAt).getTime()) / 3_600_000) * 18)
    : 0;
  const contextCost = clampPriority((item.status === "frozen" ? 30 : 0) + (item.hidden ? 18 : 0));
  const userLockPenalty = hardLocks.length > 0 ? 28 : 0;

  if (hardLocks.length > 0) {
    reasons.push("存在硬时间锁，agent 只能建议或插入，不能静默改时间。");
  }

  if (item.hidden) {
    reasons.push("隐藏目标到达触发窗口，必须先 reveal 给用户确认。");
  }

  if (item.status === "frozen") {
    reasons.push("冻结任务需要根据当前队列重新回归。");
  }

  const score = clampPriority(
    urgency * 0.3 +
      importance * 0.24 +
      deadlineRisk * 0.18 +
      timePressure * 0.12 +
      procrastinationRisk * 0.08 +
      freezeAge * 0.08 -
      effort * 0.08 -
      contextCost * 0.03 -
      userLockPenalty * 0.02
  );

  return {
    urgency,
    importance,
    deadlineRisk,
    effort,
    confidence,
    timePressure,
    procrastinationRisk,
    freezeAge,
    contextCost,
    userLockPenalty,
    score,
    reasons: reasons.length > 0 ? reasons : ["轻重缓急处于可排序状态。"]
  };
}

export function makeActionId(kind: QueueActionKind, targetId: string, now: string, suffix?: string) {
  const timeKey = now.replaceAll(":", "-").replaceAll(".", "-");
  return [kind, targetId, timeKey, suffix].filter(Boolean).join(":");
}

export function createQueueAction(input: {
  kind: QueueActionKind;
  targetId: string;
  title: string;
  priority: number;
  now: string;
  reason: string;
  confidence?: number;
  position?: number;
  scheduledFor?: string;
  payload?: Record<string, unknown>;
  requiresUserReview?: boolean;
  respectsLocks?: boolean;
  suffix?: string;
}): QueueAction {
  return {
    id: makeActionId(input.kind, input.targetId, input.now, input.suffix),
    kind: input.kind,
    targetId: input.targetId,
    title: input.title,
    priority: clampPriority(input.priority),
    position: input.position,
    scheduledFor: input.scheduledFor,
    payload: input.payload,
    reason: input.reason,
    confidence: input.confidence ?? 0.78,
    requiresUserReview: input.requiresUserReview ?? false,
    respectsLocks: input.respectsLocks ?? true,
    createdAt: input.now
  };
}
