import { NextRequest } from "next/server";
import { NEXT_CARD_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { mockAnalyzeInput, mockGeneratePlanOptions, mockRegeneratePlanOptions } from "@/lib/mock-ai";
import { backendPorts } from "@/lib/server/backend-services";
import { resolveMimoProviderConfig } from "@/lib/server/providers/mimo-ai-provider";
import type {
  AIReplyPayload,
  ChatMessage,
  ClarifyingQuestion,
  InputsState,
  PlanModeMessage,
  PlanModeTurnResult,
  PlanOption,
  SourceType
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequestBody = {
  messages: ChatMessage[];
  contextNote?: string;
  sourceType?: SourceType;
  parsedText?: string;
  regenerate?: boolean;
  previousPlans?: PlanOption[];
};

type ChatProvider = "mimo" | "deepseek" | "local";

const FALLBACK_PAYLOAD: AIReplyPayload = {
  reply: "AI 服务暂时不可用，先按本地默认理解继续。你也可以再补一句。",
  next_phase: "thinking",
  question: null,
  plans: null,
  analysis_patch: null
};

export async function POST(request: NextRequest) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  if (!Array.isArray(body.messages)) {
    return jsonResponse({ error: "messages is required" }, 400);
  }

  const latestUserText = getLatestUserText(body.messages);
  if (!latestUserText) {
    return jsonResponse({ error: "at least one user message is required" }, 400);
  }

  // DeepSeek (Anthropic protocol) is the primary provider; endpoint, key,
  // and model are hardcoded above. Local plan-mode is the fallback when
  // DeepSeek is unreachable, errors, or returns empty content.
  const deepSeekResult = await callDeepSeekChat(body);
  if (deepSeekResult) return jsonResponse(deepSeekResult, 200);

  const lastResort = await callPlanModeChat(body, latestUserText);
  if (lastResort) return jsonResponse(lastResort, 200);

  return jsonResponse({ payload: FALLBACK_PAYLOAD, fallback: true, provider: "local" satisfies ChatProvider }, 200);
}

async function callPlanModeChat(body: ChatRequestBody, latestUserText: string) {
  const sourceType = body.sourceType ?? "text";
  const parsedText = [body.parsedText, body.contextNote].filter(Boolean).join("\n");
  const providerConfigured = Boolean(resolveMimoProviderConfig());
  const result = await backendPorts.aiPlanner.createPlanModeTurn({
    inputText: latestUserText,
    sourceType,
    parsedText,
    messages: toPlanModeMessages(body.messages)
  });

  return {
    payload: planModeToAiReplyPayload(result, {
      inputText: latestUserText,
      sourceType,
      parsedText,
      regenerate: body.regenerate === true,
      previousPlans: Array.isArray(body.previousPlans) ? body.previousPlans : []
    }),
    fallback: !providerConfigured,
    provider: providerConfigured ? ("mimo" as const) : ("local" as const)
  };
}

// Endpoint, key, and model are intentionally hardcoded per project owner's
// instruction. The endpoint is DeepSeek's Anthropic-compatible Messages API
// (NOT the OpenAI-compatible /chat/completions). This means: x-api-key auth,
// anthropic-version header, content array with thinking + text blocks, and
// max_tokens lives at the top level of the request body.
const DEEPSEEK_ANTHROPIC_ENDPOINT = "https://api.deepseek.com/anthropic/v1/messages";
const DEEPSEEK_API_KEY_HARDCODED = "***REMOVED***";
const DEEPSEEK_MODEL_HARDCODED = "deepseek-v4-pro";

async function callDeepSeekChat(body: ChatRequestBody) {
  // Reasoning-class models (deepseek-v4-pro) spend a large slice of tokens on
  // hidden thinking blocks before emitting the JSON payload. 1600 leaves
  // nothing for actual output. The Next Card system prompt is long enough
  // that we have observed thinking go past 8k tokens — keep the budget high.
  const maxTokens = 16000;

  try {
    const response = await fetch(DEEPSEEK_ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": DEEPSEEK_API_KEY_HARDCODED,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(buildAnthropicRequest(body, DEEPSEEK_MODEL_HARDCODED, maxTokens))
    });

    if (!response.ok) {
      console.error("[chat] deepseek non-OK:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      stop_reason?: string;
    };
    const text =
      data.content?.find((block) => block.type === "text")?.text?.trim() ?? "";
    if (!text) {
      console.error("[chat] deepseek empty text, stop_reason=", data.stop_reason);
      return null;
    }

    return {
      payload: normalizeAiReplyPayload(parsePayload(text), {
        inputText: getLatestUserText(body.messages) || "当前目标",
        sourceType: body.sourceType ?? "text",
        parsedText: [body.parsedText, body.contextNote].filter(Boolean).join("\n"),
        regenerate: body.regenerate === true,
        previousPlans: Array.isArray(body.previousPlans) ? body.previousPlans : [],
        userTurnCount: countUserTurns(body.messages)
      }),
      fallback: false,
      provider: "deepseek" as const
    };
  } catch (err) {
    console.error("[chat] deepseek threw:", err);
    return null;
  }
}

// Anthropic Messages API: system prompt is a top-level `system` field (not a
// message), and only user/assistant alternation is allowed in `messages`.
// The Next Card system prompt asks for a strict JSON object as the reply —
// the model honors that without needing OpenAI's response_format flag.
function buildAnthropicRequest(
  body: ChatRequestBody,
  model: string,
  maxTokens: number
) {
  const systemParts = [NEXT_CARD_SYSTEM_PROMPT];
  if (body.contextNote?.trim()) {
    systemParts.push(body.contextNote.trim());
  }

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of body.messages) {
    if (!message.text.trim()) continue;
    messages.push({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text
    });
  }

  return {
    model,
    max_tokens: maxTokens,
    system: systemParts.join("\n\n"),
    messages,
    temperature: 0.35
  };
}

function planModeToAiReplyPayload(
  result: PlanModeTurnResult,
  input: { inputText: string; sourceType: SourceType; parsedText: string; regenerate?: boolean; previousPlans?: PlanOption[] }
): AIReplyPayload {
  const nextPhase = result.status === "ready-to-build" ? "ready" : "asking";
  const missing = result.analysis.missingInformation;
  const buildOptions = result.options.filter((option) => option.kind === "build");
  // Only emit plans once the planner is actually ready to build. Returning
  // plans during `asking` violates AGENTS.md "先理解、再反问、再发牌" — users
  // would see three options before they answered the clarifying question.
  const plans =
    nextPhase === "ready" && buildOptions.length > 0
      ? mergeProviderPlans(input, buildOptions.slice(0, 3), input.regenerate ? input.previousPlans : undefined)
      : null;

  return {
    reply: buildLocalReply(result, input.inputText, nextPhase),
    next_phase: nextPhase,
    question: nextPhase === "asking" ? buildQuestion(result) : null,
    plans,
    analysis_patch: {
      sourceType: input.sourceType,
      goalUnderstanding: result.analysis.goalUnderstanding,
      constraints: result.analysis.knownConstraints,
      timeStrategy: [
        result.analysis.timeJudgement,
        `发牌策略：${dealModeCopy(result.analysis.recommendedDealMode)}`,
        ...missing.map((item) => `缺口：${item}`)
      ],
      deadlineLabel: result.analysis.timeJudgement,
      availableWindow: result.analysis.recommendedDealMode === "review-before-deal" ? "先 review 再发牌" : "现在可以开始",
      suggestedStart: result.shouldBuildNow ? "现在开始第一张卡" : "补充后或按默认建牌"
    }
  };
}

function mergeProviderPlans(
  input: { inputText: string; sourceType: SourceType; parsedText: string },
  providerOptions: Array<{ label: string; description: string; planId?: PlanOption["id"] }>,
  previousPlans?: PlanOption[]
): PlanOption[] {
  const analysisInput: InputsState = {
    text: input.inputText,
    attachments: [],
    imageSchedule: null,
    parsedText: input.parsedText,
    sourceType: input.sourceType
  };
  const analysis = mockAnalyzeInput(analysisInput);
  // When the caller asks to regenerate, base the local seed off the previous
  // plans so the labels/timings actually shift instead of regressing to the
  // exact same three options. Without this, regenerate at the chat layer was
  // a silent no-op for users on the local fallback.
  const localOptions = previousPlans && previousPlans.length > 0
    ? mockRegeneratePlanOptions(analysisInput, previousPlans)
    : mockGeneratePlanOptions(analysis);

  // Always return three slots (the UI assumes plan-1/2/3). When the provider
  // only gives 1 or 2 build options we keep the local labels for the rest
  // rather than dropping them silently.
  return localOptions.map((option, index) => {
    const providerOption = providerOptions[index];
    if (!providerOption) {
      return option;
    }
    return {
      ...option,
      id: providerOption.planId ?? option.id,
      name: providerOption.label || option.name,
      summary: providerOption.description || option.summary
    };
  });
}

function buildQuestion(result: PlanModeTurnResult): ClarifyingQuestion {
  const options = result.options.slice(0, 3).map((option, index) => ({
    id: option.id || `option-${index + 1}`,
    label: option.label,
    effect: option.description
  }));

  while (options.length < 3) {
    const index = options.length + 1;
    options.push({
      id: `default-${index}`,
      label: index === 1 ? "先按默认建牌" : index === 2 ? "我补充时间" : "我补充约束",
      effect: index === 1 ? "系统先生成第一张可执行卡。" : "补完后再生成更准的方案。"
    });
  }

  return {
    id: "plan-mode-gap",
    question:
      result.analysis.missingInformation.length > 0
        ? `先补哪一块：${result.analysis.missingInformation.slice(0, 2).join("、")}？`
        : "这批牌要怎么处理？",
    options,
    defaultOptionId: options[0].id
  };
}

function normalizeAiReplyPayload(
  parsed: Partial<AIReplyPayload>,
  input: {
    inputText: string;
    sourceType: SourceType;
    parsedText: string;
    regenerate?: boolean;
    previousPlans?: PlanOption[];
    userTurnCount?: number;
  }
): AIReplyPayload {
  const requestedPhase = normalizePhase(parsed.next_phase);

  // Validate the model-attached clarifying question. We require at least
  // one option for the panel to render meaningfully.
  const hasValidQuestion =
    parsed.question &&
    Array.isArray(parsed.question.options) &&
    parsed.question.options.length > 0;

  // First-turn guarantee: never let the model skip straight to `ready` on
  // the user's very first message. If it tries, demote — to `asking` when
  // it actually has a question to ask, otherwise `thinking` so the user
  // gets a verbal probe instead of an empty options panel.
  const isFirstTurn = !input.regenerate && (input.userTurnCount ?? 0) <= 1;
  const blockReady = isFirstTurn && requestedPhase === "ready";

  // `asking` without a question is a shape mismatch — render chat-only.
  const askingDemotedToThinking = requestedPhase === "asking" && !hasValidQuestion;

  const nextPhase: AIReplyPayload["next_phase"] = blockReady
    ? hasValidQuestion
      ? "asking"
      : "thinking"
    : askingDemotedToThinking
      ? "thinking"
      : requestedPhase;

  const plans =
    nextPhase === "ready" && Array.isArray(parsed.plans)
      ? mergeProviderPlans(
          input,
          parsed.plans.slice(0, 3).map((plan) => ({
            label: plan.name,
            description: plan.summary,
            planId: plan.id
          })),
          input.regenerate ? input.previousPlans : undefined
        )
      : null;

  return {
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : FALLBACK_PAYLOAD.reply,
    next_phase: nextPhase,
    question: nextPhase === "asking" ? (parsed.question ?? null) : null,
    plans,
    analysis_patch: parsed.analysis_patch ?? null
  };
}

function countUserTurns(messages: ChatMessage[]): number {
  return messages.filter((m) => m.role === "user" && m.text.trim()).length;
}

function toPlanModeMessages(messages: ChatMessage[]): PlanModeMessage[] {
  return messages.slice(-20).map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.text,
    createdAt: message.createdAt
  }));
}

function parsePayload(content: string): Partial<AIReplyPayload> {
  if (!content) {
    return FALLBACK_PAYLOAD;
  }

  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    return JSON.parse(cleaned) as Partial<AIReplyPayload>;
  } catch {
    return {
      ...FALLBACK_PAYLOAD,
      reply: content.slice(0, 200) || FALLBACK_PAYLOAD.reply
    };
  }
}

function getLatestUserText(messages: ChatMessage[]) {
  return [...messages]
    .reverse()
    .find((message) => message.role === "user" && message.text.trim())
    ?.text.trim();
}

function normalizePhase(value: unknown): AIReplyPayload["next_phase"] {
  return value === "thinking" || value === "asking" || value === "generating" || value === "ready"
    ? value
    : "thinking";
}

function dealModeCopy(mode: PlanModeTurnResult["analysis"]["recommendedDealMode"]) {
  if (mode === "deal-two-cards") {
    return "先发 1-2 张，其余后台拆分";
  }

  if (mode === "review-before-deal") {
    return "大导入先检阅，再发第一张";
  }

  return "先发第一张行动牌";
}

// Local fallback reply generator. The point is NOT to fake a smart model —
// it is to produce a sentence that quotes something specific from the user's
// own input ("今晚 20:00 / 一页 / 课程分析" → "20:00 还有多久？一页是要写多深？")
// so the user does not see a templated phrase like "选个方向". When DeepSeek
// is configured this path is rarely hit; when it is, at least the reply
// references the actual goal instead of a stock string.
function buildLocalReply(
  result: PlanModeTurnResult,
  inputText: string,
  nextPhase: AIReplyPayload["next_phase"]
): string {
  if (nextPhase === "ready") {
    return "";
  }

  const text = inputText.trim();
  if (!text) {
    return "";
  }

  const time = text.match(/\d{1,2}[:：]\d{2}|今晚|今天|明天|早八|课前|周[一二三四五六日天]/);
  const quantity = text.match(/[一二三四五六七八九十两\d]+\s*(页|节|题|道|篇|份|分钟|小时|公里|本|章|个|条)/);
  const verb = text.match(/(交|提交|完成|写|做|去|赶|背|看|读|听|练|改|复习|准备|出门|到课|考试)/);
  const subject = text.match(/(高数|英语|物理|化学|生物|历史|政治|语文|课程|课表|教材|论文|报告|作业|分析|总结|笔记|题目|材料)/);

  const probes: string[] = [];
  if (time && quantity && verb) {
    probes.push(`离 ${time[0]} 还有多久？${quantity[0]}打算${verb[0]}多深？`);
  } else if (time && verb) {
    probes.push(`离 ${time[0]} 还剩多少？${verb[0]}到什么程度算 OK？`);
  } else if (time) {
    probes.push(`离 ${time[0]} 还多久？这之前必须做完哪一块？`);
  } else if (quantity && verb && subject) {
    probes.push(`${quantity[0]}${subject[0]}——${verb[0]}成什么样算交得了？`);
  } else if (subject && verb) {
    probes.push(`${subject[0]}你${verb[0]}过没有？现在卡在哪一步？`);
  } else if (subject) {
    probes.push(`${subject[0]}这事，你现在最想先解决哪个？`);
  } else if (verb) {
    probes.push(`${verb[0]}什么？要做到什么程度？`);
  } else {
    probes.push(`「${text.slice(0, 16)}」这事，你现在最卡在哪？`);
  }

  return probes[0];
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
