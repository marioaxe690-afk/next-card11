import type { AiPlannerPort, MultimodalImportParserPort } from "@/lib/server/backend-ports";
import { createImportReview } from "@/lib/server/import-coverage";
import { createPlanModeTurn } from "@/lib/server/plan-mode-service";
import type {
  ImportConflict,
  ImportCoverageCheck,
  ImportedTopLevelCard,
  ImportReviewResult,
  PlanModeOption,
  PlanModeTurnResult,
  SourceType
} from "@/lib/types";

export type MimoProviderConfig = {
  baseUrl: string;
  apiKey: string;
  plannerModel: string;
  multimodalModel: string;
  strict: boolean;
  timeoutMs: number;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type PlannerFactoryOptions = {
  config: MimoProviderConfig;
  fetchImpl?: FetchLike;
  fallback?: AiPlannerPort["createPlanModeTurn"];
};

type ImportParserFactoryOptions = {
  config: MimoProviderConfig;
  fetchImpl?: FetchLike;
  fallback?: MultimodalImportParserPort["parseImport"];
};

const DEFAULT_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const DEFAULT_PLANNER_MODEL = "mimo-v2.5-pro";
const DEFAULT_MULTIMODAL_MODEL = "mimo-v2.5";
const DEFAULT_TIMEOUT_MS = 30000;

export function resolveMimoProviderConfig(env: NodeJS.ProcessEnv = process.env): MimoProviderConfig | null {
  const apiKey = firstEnv(env.MIMO_API_KEY, env.NEXT_CARD_MIMO_API_KEY, env.MIMO_OPENAI_API_KEY);
  if (!apiKey) {
    return null;
  }

  return {
    baseUrl: firstEnv(env.MIMO_BASE_URL, env.NEXT_CARD_MIMO_BASE_URL) ?? DEFAULT_BASE_URL,
    apiKey,
    plannerModel: firstEnv(env.MIMO_PLANNER_MODEL, env.NEXT_CARD_MIMO_PLANNER_MODEL) ?? DEFAULT_PLANNER_MODEL,
    multimodalModel:
      firstEnv(env.MIMO_MULTIMODAL_MODEL, env.NEXT_CARD_MIMO_MULTIMODAL_MODEL) ?? DEFAULT_MULTIMODAL_MODEL,
    strict: parseBoolean(firstEnv(env.NEXT_CARD_AI_STRICT, env.MIMO_STRICT), false),
    timeoutMs: parseInteger(firstEnv(env.MIMO_TIMEOUT_MS, env.NEXT_CARD_MIMO_TIMEOUT_MS), DEFAULT_TIMEOUT_MS)
  };
}

export function createMimoAiPlanner({
  config,
  fetchImpl = fetch,
  fallback = async (input) => createPlanModeTurn(input)
}: PlannerFactoryOptions): AiPlannerPort {
  const client = createMimoChatClient(config, fetchImpl);

  return {
    async createPlanModeTurn(input) {
      try {
        const raw = await client.chatJson({
          model: config.plannerModel,
          systemPrompt: buildPlannerSystemPrompt(),
          userPayload: {
            inputText: input.inputText,
            sourceType: input.sourceType,
            parsedText: input.parsedText ?? "",
            messages: (input.messages ?? []).slice(-20)
          }
        });

        return normalizePlanModeTurn(raw, input.sourceType, input.messages?.length ?? 0);
      } catch (error) {
        if (!config.strict) {
          return fallback(input);
        }

        throw new Error(`Mimo planner failed: ${errorMessage(error)}`);
      }
    }
  };
}

export function createMimoImportParser({
  config,
  fetchImpl = fetch,
  fallback = async (input) => createImportReview(input)
}: ImportParserFactoryOptions): MultimodalImportParserPort {
  const client = createMimoChatClient(config, fetchImpl);

  return {
    async parseImport(input) {
      try {
        const raw = await client.chatJson({
          model: config.multimodalModel,
          systemPrompt: buildImportSystemPrompt(),
          userPayload: {
            sourceType: input.sourceType,
            rawText: input.rawText,
            attachmentName: input.attachmentName ?? "",
            ...(input.imageDataUrl
              ? {
                  imageMimeType: input.imageMimeType ?? "image/jpeg",
                  imagePayload: "attached as OpenAI-compatible image_url"
                }
              : {})
          },
          imageDataUrl: input.imageDataUrl
        });

        return normalizeImportReview(raw, input.sourceType, input.rawText);
      } catch (error) {
        if (!config.strict && input.rawText.trim()) {
          return fallback(input);
        }

        throw new Error(`Mimo multimodal import parser failed: ${errorMessage(error)}`);
      }
    }
  };
}

function createMimoChatClient(config: MimoProviderConfig, fetchImpl: FetchLike) {
  return {
    async chatJson(input: {
      model: string;
      systemPrompt: string;
      userPayload: Record<string, unknown>;
      imageDataUrl?: string;
    }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      const userMessageContent = input.imageDataUrl
        ? [
            {
              type: "text",
              text: JSON.stringify(input.userPayload, null, 2)
            },
            {
              type: "image_url",
              image_url: {
                url: input.imageDataUrl
              }
            }
          ]
        : JSON.stringify(input.userPayload, null, 2);

      try {
        const response = await fetchImpl(`${trimTrailingSlash(config.baseUrl)}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: input.model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            thinking: { type: "disabled" },
            messages: [
              { role: "system", content: input.systemPrompt },
              { role: "user", content: userMessageContent }
            ]
          }),
          signal: controller.signal
        });

        const body = (await response.json().catch(() => null)) as unknown;
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${readProviderError(body)}`);
        }

        const content = readAssistantContent(body);
        if (!content) {
          throw new Error("missing assistant content");
        }

        return parseModelJson(content);
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

function buildPlannerSystemPrompt() {
  return [
    "You are the Next Card backend planning agent.",
    "Return JSON only. Do not include Markdown, prose, or code fences.",
    "Use a Codex Plan Mode style: analyze first, expose missing information as selectable gaps, then provide options.",
    "Do not ask open-ended chatbot questions.",
    "Schema:",
    JSON.stringify(
      {
        status: "ready-to-build | needs-supplement | needs-review",
        shouldBuildNow: true,
        analysis: {
          goalUnderstanding: "string",
          knownConstraints: ["string"],
          missingInformation: ["string"],
          timeJudgement: "string",
          recommendedDealMode: "deal-first-card | deal-two-cards | review-before-deal"
        },
        options: [
          { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "string" },
          { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "string" },
          { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "string" },
          { id: "supplement", label: "否，我要自己补充", kind: "supplement", description: "string" }
        ],
        context: { messagesUsed: 0, facts: ["string"] }
      },
      null,
      2
    )
  ].join("\n");
}

function buildImportSystemPrompt() {
  return [
    "You are the Next Card multimodal import coverage agent.",
    "Return JSON only. Do not include Markdown, prose, or code fences.",
    "Parse timetable, notice, attachment, image timetable, or multimodal text into top-level cards.",
    "Large imports must require review, deal only the first one or two cards now, and put the rest into hiddenBacklogCards.",
    "Cross-check omissions, deadlines, reminders, and same-time conflicts.",
    "Schema:",
    JSON.stringify(
      {
        reviewRequired: true,
        topLevelCards: [
          {
            id: "string",
            title: "string",
            sourceLine: "string",
            timeLabel: "string",
            kind: "course | deadline | reminder | task",
            reviewStatus: "pending"
          }
        ],
        dealNowCards: [],
        hiddenBacklogCards: [],
        coverageChecks: [
          { kind: "timetable-line-count", passed: true, detail: "string" },
          { kind: "deadline-count", passed: true, detail: "string" },
          { kind: "reminder-count", passed: true, detail: "string" },
          { kind: "conflict-scan", passed: true, detail: "string" },
          { kind: "omission-scan", passed: true, detail: "string" }
        ],
        possibleOmissions: ["string"],
        conflicts: [],
        userReviewPrompt: "string"
      },
      null,
      2
    )
  ].join("\n");
}

function normalizePlanModeTurn(raw: unknown, sourceType: SourceType, inputMessageCount: number): PlanModeTurnResult {
  const object = asRecord(raw);
  const analysis = asRecord(object.analysis);
  const status = normalizeStatus(object.status, Boolean(object.shouldBuildNow));
  const shouldBuildNow = typeof object.shouldBuildNow === "boolean" ? object.shouldBuildNow : status === "ready-to-build";
  const missingInformation = stringArray(analysis.missingInformation);
  const options = normalizePlanModeOptions(object.options, shouldBuildNow);

  return {
    status,
    shouldBuildNow,
    analysis: {
      goalUnderstanding: stringValue(analysis.goalUnderstanding, "已理解用户目标，准备进入结构化建牌。"),
      knownConstraints: stringArray(analysis.knownConstraints),
      missingInformation,
      timeJudgement: stringValue(analysis.timeJudgement, "未识别明确时间，先按默认启动窗口处理。"),
      recommendedDealMode: normalizeDealMode(analysis.recommendedDealMode, sourceType)
    },
    options,
    context: {
      messagesUsed: clampInteger(
        asRecord(object.context).messagesUsed,
        0,
        Math.min(inputMessageCount, 20),
        Math.min(inputMessageCount, 20)
      ),
      facts: stringArray(asRecord(object.context).facts).slice(0, 8)
    }
  };
}

function normalizePlanModeOptions(rawOptions: unknown, shouldBuildNow: boolean): PlanModeOption[] {
  const options = Array.isArray(rawOptions)
    ? rawOptions
        .map((option) => {
          const object = asRecord(option);
          const kind = normalizeOptionKind(object.kind);
          const planId = normalizePlanId(object.planId);

          return {
            id: stringValue(object.id, planId ?? kind),
            label: stringValue(object.label, kind === "supplement" ? "否，我要自己补充" : "执行方案一"),
            kind,
            description: stringValue(object.description, "按当前信息继续。"),
            ...(planId ? { planId } : {})
          } satisfies PlanModeOption;
        })
        .filter((option) => option.id && option.label)
    : [];

  if (!shouldBuildNow && options.length === 0) {
    return [
      {
        id: "default-build",
        label: "先按默认建牌",
        kind: "default-build",
        description: "使用默认时间窗口和最小行动卡，先生成第一张牌。"
      },
      {
        id: "supplement",
        label: "否，我要自己补充",
        kind: "supplement",
        description: "补充具体目标、截止时间或不可改安排。"
      }
    ];
  }

  const buildOptions = options.filter((option) => option.kind === "build").slice(0, 3);
  const supplement = options.find((option) => option.kind === "supplement") ?? {
    id: "supplement",
    label: "否，我要自己补充",
    kind: "supplement" as const,
    description: "用户补充时间、地点、约束或想保留的安排。"
  };

  return buildOptions.length === 3 ? [...buildOptions, supplement] : [...defaultBuildOptions(), supplement];
}

function defaultBuildOptions(): PlanModeOption[] {
  return [
    { id: "plan-1", label: "方案一", kind: "build", planId: "plan-1", description: "优先发出最小可行动作。" },
    { id: "plan-2", label: "方案二", kind: "build", planId: "plan-2", description: "平衡速度和完整度。" },
    { id: "plan-3", label: "方案三", kind: "build", planId: "plan-3", description: "用低压力方式开始推进。" }
  ];
}

function normalizeImportReview(raw: unknown, sourceType: SourceType, rawText: string): ImportReviewResult {
  const object = asRecord(raw);
  const topLevelCards = normalizeTopLevelCards(object.topLevelCards);

  if (topLevelCards.length === 0) {
    return createImportReview({ sourceType, rawText });
  }

  const dealNowCards = normalizeTopLevelCards(object.dealNowCards);
  const hiddenBacklogCards = normalizeTopLevelCards(object.hiddenBacklogCards);
  const normalizedDealNow = dealNowCards.length > 0 ? dealNowCards.slice(0, 2) : topLevelCards.slice(0, 2);
  const normalizedHidden =
    hiddenBacklogCards.length > 0
      ? hiddenBacklogCards
      : topLevelCards.filter((card) => !normalizedDealNow.some((dealCard) => dealCard.id === card.id));

  return {
    reviewRequired: typeof object.reviewRequired === "boolean" ? object.reviewRequired : sourceType !== "text" || topLevelCards.length > 1,
    topLevelCards,
    dealNowCards: normalizedDealNow,
    hiddenBacklogCards: normalizedHidden,
    coverageChecks: normalizeCoverageChecks(object.coverageChecks),
    possibleOmissions: stringArray(object.possibleOmissions),
    conflicts: normalizeConflicts(object.conflicts),
    userReviewPrompt: stringValue(
      object.userReviewPrompt,
      "请先检阅 AI 识别出的顶层牌清单，确认没有漏掉课程、截止或提醒，再进入发牌。"
    )
  };
}

function normalizeTopLevelCards(rawCards: unknown): ImportedTopLevelCard[] {
  if (!Array.isArray(rawCards)) {
    return [];
  }

  return rawCards
    .map((card, index): ImportedTopLevelCard => {
      const object = asRecord(card);
      const kind = normalizeImportKind(object.kind);
      const sourceLine = stringValue(object.sourceLine, stringValue(object.title, `导入项目 ${index + 1}`));

      return {
        id: stringValue(object.id, `import-card-${index + 1}`),
        title: stringValue(object.title, `${kindLabel(kind)}：${sourceLine}`),
        sourceLine,
        ...(typeof object.timeLabel === "string" && object.timeLabel.trim() ? { timeLabel: object.timeLabel.trim() } : {}),
        kind,
        reviewStatus: "pending"
      };
    })
    .filter((card) => card.title.trim() && card.sourceLine.trim());
}

function normalizeCoverageChecks(rawChecks: unknown): ImportCoverageCheck[] {
  const checks = Array.isArray(rawChecks)
    ? rawChecks
        .map((check) => {
          const object = asRecord(check);
          const kind = normalizeCoverageKind(object.kind);
          if (!kind) {
            return null;
          }

          return {
            kind,
            passed: typeof object.passed === "boolean" ? object.passed : false,
            detail: stringValue(object.detail, "模型未给出检查细节。")
          } satisfies ImportCoverageCheck;
        })
        .filter((check): check is ImportCoverageCheck => Boolean(check))
    : [];

  return checks.length > 0
    ? checks
    : [
        { kind: "timetable-line-count", passed: true, detail: "模型返回了顶层牌清单。" },
        { kind: "deadline-count", passed: true, detail: "已检查截止类项目。" },
        { kind: "reminder-count", passed: true, detail: "已检查提醒类项目。" },
        { kind: "conflict-scan", passed: true, detail: "已检查同时间冲突。" },
        { kind: "omission-scan", passed: true, detail: "已检查明显遗漏提示。" }
      ];
}

function normalizeConflicts(rawConflicts: unknown): ImportConflict[] {
  if (!Array.isArray(rawConflicts)) {
    return [];
  }

  return rawConflicts.map((conflict, index) => {
    const object = asRecord(conflict);

    return {
      kind: normalizeConflictKind(object.kind),
      ...(typeof object.timeLabel === "string" && object.timeLabel.trim() ? { timeLabel: object.timeLabel.trim() } : {}),
      itemIds: stringArray(object.itemIds),
      detail: stringValue(object.detail, `导入冲突 ${index + 1}`)
    };
  });
}

function parseModelJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("model response is not JSON");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function readAssistantContent(body: unknown) {
  const choices = asRecord(body).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }

  const message = asRecord(asRecord(choices[0]).message);

  return stringValue(message.content, stringValue(message.reasoning_content, ""));
}

function readProviderError(body: unknown) {
  const error = asRecord(asRecord(body).error);
  return stringValue(error.message, "provider request failed");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstEnv(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return /^(1|true|yes|on)$/i.test(value);
}

function parseInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeStatus(value: unknown, shouldBuildNow: boolean): PlanModeTurnResult["status"] {
  return value === "ready-to-build" || value === "needs-supplement" || value === "needs-review"
    ? value
    : shouldBuildNow
      ? "ready-to-build"
      : "needs-supplement";
}

function normalizeDealMode(value: unknown, sourceType: SourceType): PlanModeTurnResult["analysis"]["recommendedDealMode"] {
  if (value === "deal-first-card" || value === "deal-two-cards" || value === "review-before-deal") {
    return value;
  }

  return sourceType === "attachment" || sourceType === "image" || sourceType === "mixed" ? "review-before-deal" : "deal-first-card";
}

function normalizeOptionKind(value: unknown): PlanModeOption["kind"] {
  return value === "supplement" || value === "default-build" || value === "review" || value === "build" ? value : "build";
}

function normalizePlanId(value: unknown): PlanModeOption["planId"] | undefined {
  return value === "plan-1" || value === "plan-2" || value === "plan-3" ? value : undefined;
}

function normalizeImportKind(value: unknown): ImportedTopLevelCard["kind"] {
  return value === "course" || value === "deadline" || value === "reminder" || value === "task" ? value : "task";
}

function normalizeCoverageKind(value: unknown): ImportCoverageCheck["kind"] | null {
  return value === "timetable-line-count" ||
    value === "deadline-count" ||
    value === "reminder-count" ||
    value === "conflict-scan" ||
    value === "omission-scan"
    ? value
    : null;
}

function normalizeConflictKind(value: unknown): ImportConflict["kind"] {
  return value === "same-time-conflict" || value === "duplicate-title" || value === "missing-deadline" ? value : "same-time-conflict";
}

function kindLabel(kind: ImportedTopLevelCard["kind"]) {
  return kind === "course" ? "课程" : kind === "deadline" ? "截止" : kind === "reminder" ? "提醒" : "任务";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
