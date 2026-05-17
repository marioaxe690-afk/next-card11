import type { QueueAction, TaskCard, TaskDeck } from "@/lib/types";

export type ScheduleActionKind =
  | "create-reminder"
  | "update-reminder"
  | "cancel-reminder"
  | "create-calendar-event"
  | "update-calendar-event"
  | "cancel-calendar-event"
  | "create-notification";

export type ScheduleActionStatus = "proposed" | "scheduled" | "sent" | "cancelled" | "failed";
export type ReminderPermissionState = "unknown" | "unsupported" | "default" | "requested" | "granted" | "denied";

export type ScheduleTarget = {
  type: "card" | "deck" | "proof";
  id: string;
  title: string;
};

export type AgentScheduleAction = {
  id: string;
  kind: ScheduleActionKind;
  target: ScheduleTarget;
  title: string;
  body: string;
  scheduledAt: string;
  timezone: string;
  channel: "browser-notification" | "calendar" | "in-app";
  status: ScheduleActionStatus;
  scheduledByRuntimeAt?: string;
  sentAt?: string;
  failedAt?: string;
  failureReason?: string;
  attemptCount?: number;
  agentDecision: {
    source: "freeze-agent" | "planner" | "user";
    reason: string;
    confidence: number;
    requiresUserConfirmation: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type ScheduleState = {
  actions: AgentScheduleAction[];
  reminderPermission: ReminderPermissionState;
  lastRuntimeCheckAt: string | null;
  lastAgentNote: string | null;
};

export type ScheduleValidationResult = {
  ok: boolean;
  errors: string[];
};

const makeScheduleId = () => `schedule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export function createFreezeReminderAction({
  card,
  deck,
  now = new Date().toISOString(),
  timezone = "Asia/Shanghai"
}: {
  card: TaskCard;
  deck: TaskDeck;
  now?: string;
  timezone?: string;
}): AgentScheduleAction {
  const fallback = new Date(now);
  fallback.setMinutes(fallback.getMinutes() + 90);
  const scheduledAt = card.suggestedStartAt ?? card.deadlineAt ?? fallback.toISOString();

  return {
    id: makeScheduleId(),
    kind: "create-reminder",
    target: {
      type: "card",
      id: card.id,
      title: card.title
    },
    title: `恢复：${card.title}`,
    body: `「${deck.coverTitle}」里的冻结卡适合恢复。先做 ${card.estimatedMinutes} 分钟内的最小动作。`,
    scheduledAt,
    timezone,
    channel: "browser-notification",
    status: "proposed",
    agentDecision: {
      source: "freeze-agent",
      reason: "用户选择冻结，agent 根据建议开始时间插入温和恢复提醒。",
      confidence: 0.78,
      requiresUserConfirmation: false
    },
    createdAt: now,
    updatedAt: now
  };
}

export function validateScheduleAction(action: Partial<AgentScheduleAction>, now = new Date()): ScheduleValidationResult {
  const errors: string[] = [];

  if (!action.kind) {
    errors.push("kind is required");
  }

  if (!action.target?.type || !action.target.id) {
    errors.push("target is required");
  }

  if (!action.title?.trim()) {
    errors.push("title is required");
  }

  if (!action.agentDecision?.reason?.trim()) {
    errors.push("agentDecision.reason is required");
  }

  if (!action.scheduledAt) {
    errors.push("scheduledAt is required");
  } else if (Number.isNaN(new Date(action.scheduledAt).getTime())) {
    errors.push("scheduledAt must be an ISO date");
  } else if (new Date(action.scheduledAt).getTime() <= now.getTime()) {
    errors.push("scheduledAt must be in the future");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function toQueueAction(action: AgentScheduleAction): QueueAction | null {
  const kindMap: Partial<Record<ScheduleActionKind, QueueAction["kind"]>> = {
    "create-reminder": "create-reminder",
    "update-reminder": "update-reminder",
    "create-notification": "create-reminder",
    "create-calendar-event": "create-calendar-event",
    "update-calendar-event": "update-calendar-event"
  };
  const queueKind = kindMap[action.kind];

  if (!queueKind) {
    return null;
  }

  return {
    id: `compat:${action.id}`,
    kind: queueKind,
    targetId: action.target.id,
    title: action.title,
    priority: Math.round(action.agentDecision.confidence * 100),
    scheduledFor: action.scheduledAt,
    payload: {
      body: action.body,
      timezone: action.timezone,
      channel: action.channel,
      sourceActionId: action.id
    },
    reason: action.agentDecision.reason,
    confidence: action.agentDecision.confidence,
    requiresUserReview: action.agentDecision.requiresUserConfirmation,
    respectsLocks: true,
    createdAt: action.createdAt
  };
}
