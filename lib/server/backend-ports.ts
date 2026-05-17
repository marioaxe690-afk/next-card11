import type {
  BackendWorkerSnapshot,
  BackendWorkerTickResult,
  ImportReviewResult,
  InputsState,
  PlanModeMessage,
  PlanModeTurnResult,
  QueueAction,
  SchedulePlannerInput,
  SchedulePlannerOutput
} from "@/lib/types";

export type AiPlannerPort = {
  createPlanModeTurn(input: {
    inputText: string;
    sourceType: InputsState["sourceType"];
    parsedText?: string;
    messages?: PlanModeMessage[];
  }): Promise<PlanModeTurnResult>;
};

export type MultimodalImportParserPort = {
  parseImport(input: {
    sourceType: InputsState["sourceType"];
    rawText: string;
    attachmentName?: string;
    imageDataUrl?: string;
    imageMimeType?: string;
  }): Promise<ImportReviewResult>;
};

export type SchedulePlannerPort = {
  plan(input: SchedulePlannerInput): Promise<SchedulePlannerOutput>;
};

export type NotificationPort = {
  createOrUpdate(action: QueueAction): Promise<NotificationDeliveryResult>;
};

export type CalendarPort = {
  createOrUpdate(action: QueueAction): Promise<CalendarDeliveryResult>;
};

export type NotificationDeliveryResult = {
  providerId: string;
  status: "scheduled" | "updated" | "skipped" | "failed";
  sentCount?: number;
  failedCount?: number;
  removedSubscriptionIds?: string[];
  error?: string;
};

export type CalendarDeliveryResult = {
  providerId: string;
  status: "created" | "updated" | "skipped" | "failed";
  filePath?: string;
  eventUid?: string;
  error?: string;
};

export type QueueRepository = {
  readSnapshot(now: string): Promise<BackendWorkerSnapshot>;
  writeSnapshot(snapshot: BackendWorkerSnapshot): Promise<void>;
  markActionsProcessed(actions: QueueAction[]): Promise<void>;
};

export type BackendWorkerPort = {
  tick(snapshot: BackendWorkerSnapshot): Promise<BackendWorkerTickResult>;
};

export type BackendPorts = {
  aiPlanner: AiPlannerPort;
  multimodalImportParser: MultimodalImportParserPort;
  schedulePlanner: SchedulePlannerPort;
  notifications: NotificationPort;
  calendar: CalendarPort;
  queueRepository: QueueRepository;
  worker: BackendWorkerPort;
};
