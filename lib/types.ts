export type SourceType = "text" | "attachment" | "image" | "mixed";
export type UrgencyStage = "calm" | "warm" | "hot" | "burning" | "expired";
export type DamageEffect = "none" | "burn" | "freeze" | "crack" | "weathering";

export type UploadedAttachment = {
  id: string;
  name: string;
  kind: "notice" | "document" | "unknown";
  mockedText: string;
  size?: number;
  mimeType?: string;
};

export type UploadedImage = {
  id: string;
  name: string;
  parsedTimetable: string;
  size?: number;
  mimeType?: string;
};

export type InputsState = {
  text: string;
  attachments: UploadedAttachment[];
  imageSchedule: UploadedImage | null;
  parsedText: string;
  sourceType: SourceType;
};

export type AnalysisResult = {
  sourceType: SourceType;
  goalUnderstanding: string;
  constraints: string[];
  stages: string[];
  timeStrategy: string[];
  deadlineLabel: string;
  availableWindow: string;
  suggestedStart: string;
};

export type PlanOption = {
  id: "plan-1" | "plan-2" | "plan-3";
  name: string;
  style: "urgent" | "balanced" | "gentle";
  summary: string;
  estimatedTime: string;
  detailLevel: "high" | "medium" | "low";
  steps: string[];
};

export type PlansState = {
  goalUnderstanding: string;
  constraints: string[];
  timeStrategy: string[];
  options: PlanOption[];
  selectedPlanId: string | null;
  regenerateCount: number;
};

export type TaskFlowNode = {
  id: string;
  title: string;
  status: "not-started" | "active" | "completed" | "frozen" | "failed" | "rewarded" | "attention";
  progress: number;
  timeLabel: string;
  urgencyStage: UrgencyStage;
};

export type TaskFlowState = {
  title: string;
  nodes: TaskFlowNode[];
  edges: { from: string; to: string }[];
  overallProgress: number;
};

export type TaskDeck = {
  id: string;
  coverTitle: string;
  coverIcon: string;
  deckStatus: "new" | "active" | "frozen" | "failed" | "completed" | "needs-review";
  cards: TaskCard[];
  totalCards: number;
  completedCards: number;
};

export type TaskCard = {
  id: string;
  deckId: string;
  flowNodeId: string;
  title: string;
  action: string;
  estimatedMinutes: number;
  deadlineAt: string | null;
  suggestedStartAt: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  urgencyStage: UrgencyStage;
  damageEffect: DamageEffect;
  damageProgress: number;
  burnLevel: 0 | 1 | 2 | 3;
  status: "queued" | "active" | "completed" | "frozen" | "rewarded" | "needs-review";
  encouragement: string;
  cardBackNote: string;
};

export type RewardCard = {
  id: string;
  deckId: string;
  title: string;
  summary: string;
  actualMinutes: number;
  timePerformance: string;
  createdAt: string;
};

export type DeckState = {
  decks: TaskDeck[];
  activeDeckId: string | null;
  currentCardId: string | null;
  completedCardIds: string[];
  frozenCardIds: string[];
  rewardCards: RewardCard[];
  rescheduleQueue: string[];
  activeTimeMode: "idle" | "timing" | "burning" | "paused";
};

export type ProofRecord = {
  id: string;
  deckId?: string;
  cardId?: string;
  goalTitle: string;
  source: SourceType;
  status: "completed" | "in-progress" | "frozen" | "failed" | "rewarded" | "needs-review";
  progress: number;
  completedCards: number;
  frozenCards: number;
  actualMinutes: number;
  timeStatus: "on-time" | "burning-completed" | "frozen-rescheduled" | "expired";
  timeDamageEvents: string[];
  lastDamageEffect?: Exclude<DamageEffect, "none">;
  lastAction: string;
  nextSuggestion: string;
  createdAt: string;
};

export type ProofsState = {
  records: ProofRecord[];
  summaryDocument: string;
};

export type LastCompletion = {
  deckId: string;
  cardId: string;
  proofId: string;
};

export type OverlayType =
  | "guide"
  | "task-node-detail"
  | "plan-catalog-detail"
  | "deck-stack-detail"
  | "deck-card-detail"
  | "evidence-review"
  | "reward-review"
  | "freeze-review"
  | "burn-review"
  | "burn-failed-review"
  | "frozen-todo-review"
  | "proof-excel-review"
  | "completion-receipt"
  | "summary-review"
  | "proof-record-review";

export type ActiveOverlay = {
  type: OverlayType;
  id?: string;
} | null;

export type Mode = "input" | "deck" | "proof";
