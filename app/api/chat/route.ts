import { NextRequest } from "next/server";
import { NEXT_CARD_SYSTEM_PROMPT } from "@/lib/ai-prompts";
import { mockAnalyzeInput, mockGeneratePlanOptions } from "@/lib/mock-ai";
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
};

type ChatProvider = "mimo" | "deepseek" | "local";

type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

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

  const preferredProvider = getPreferredChatProvider();

  if (preferredProvider === "deepseek") {
    const deepSeek = await callDeepSeekChat(body);
    if (deepSeek) {
      return jsonResponse(deepSeek, 200);
    }
  }

  const mimo = await callPlanModeChat(body, latestUserText);
  if (mimo) {
    return jsonResponse(mimo, 200);
  }

  const deepSeek = await callDeepSeekChat(body);
  if (deepSeek) {
    return jsonResponse(deepSeek, 200);
  }

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
      parsedText
    }),
    fallback: !providerConfigured,
    provider: providerConfigured ? ("mimo" as const) : ("local" as const)
  };
}

async function callDeepSeekChat(body: ChatRequestBody) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: toDeepSeekMessages(body.messages, body.contextNote),
        response_format: { type: "json_object" },
        temperature: 0.35,
        max_tokens: 1600
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";

    return {
      payload: normalizeAiReplyPayload(parsePayload(content), {
        inputText: getLatestUserText(body.messages) || "当前目标",
        sourceType: body.sourceType ?? "text",
        parsedText: [body.parsedText, body.contextNote].filter(Boolean).join("\n")
      }),
      fallback: false,
      provider: "deepseek" as const
    };
  } catch {
    return null;
  }
}

function planModeToAiReplyPayload(
  result: PlanModeTurnResult,
  input: { inputText: string; sourceType: SourceType; parsedText: string }
): AIReplyPayload {
  const nextPhase = result.status === "ready-to-build" ? "ready" : "asking";
  const missing = result.analysis.missingInformation;
  const buildOptions = result.options.filter((option) => option.kind === "build");

  return {
    reply:
      result.status === "ready-to-build"
        ? "OK，我直接给你三套方案。"
        : missing.length > 0
          ? `还差 ${missing.slice(0, 2).join("、")}。你也可以先按默认建牌。`
          : "这次适合先检阅一下，再发第一张牌。",
    next_phase: nextPhase,
    question: nextPhase === "asking" ? buildQuestion(result) : null,
    plans: buildOptions.length >= 3 ? mergeProviderPlans(input, buildOptions.slice(0, 3)) : null,
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
  providerOptions: Array<{ label: string; description: string; planId?: PlanOption["id"] }>
): PlanOption[] {
  const analysisInput: InputsState = {
    text: input.inputText,
    attachments: [],
    imageSchedule: null,
    parsedText: input.parsedText,
    sourceType: input.sourceType
  };
  const localOptions = mockGeneratePlanOptions(mockAnalyzeInput(analysisInput));

  return localOptions.map((option, index) => {
    const providerOption = providerOptions[index];

    return {
      ...option,
      id: providerOption?.planId ?? option.id,
      name: providerOption?.label || option.name,
      summary: providerOption?.description || option.summary
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
  input: { inputText: string; sourceType: SourceType; parsedText: string }
): AIReplyPayload {
  const plans = Array.isArray(parsed.plans)
    ? mergeProviderPlans(
        input,
        parsed.plans.slice(0, 3).map((plan) => ({
          label: plan.name,
          description: plan.summary,
          planId: plan.id
        }))
      )
    : null;

  return {
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : FALLBACK_PAYLOAD.reply,
    next_phase: normalizePhase(parsed.next_phase),
    question: parsed.question ?? null,
    plans,
    analysis_patch: parsed.analysis_patch ?? null
  };
}

function toPlanModeMessages(messages: ChatMessage[]): PlanModeMessage[] {
  return messages.slice(-20).map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.text,
    createdAt: message.createdAt
  }));
}

function toDeepSeekMessages(messages: ChatMessage[], contextNote?: string): DeepSeekMessage[] {
  const out: DeepSeekMessage[] = [{ role: "system", content: NEXT_CARD_SYSTEM_PROMPT }];

  if (contextNote?.trim()) {
    out.push({ role: "system", content: contextNote.trim() });
  }

  for (const message of messages) {
    if (!message.text.trim()) {
      continue;
    }

    out.push({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text
    });
  }

  return out;
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

function getPreferredChatProvider(): ChatProvider {
  const raw = process.env.NEXT_CARD_CHAT_PROVIDER?.trim().toLowerCase();

  return raw === "deepseek" ? "deepseek" : "mimo";
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
