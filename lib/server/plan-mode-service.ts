import { mockAnalyzeInput, mockGeneratePlanOptions } from "@/lib/mock-ai";
import type { InputsState, PlanModeMessage, PlanModeTurnResult, SourceType } from "@/lib/types";

export function createPlanModeTurn(input: {
  inputText: string;
  sourceType: SourceType;
  parsedText?: string;
  messages?: PlanModeMessage[];
}): PlanModeTurnResult {
  const messages = (input.messages ?? []).slice(-20);
  const facts = extractFacts(messages);
  const analysisInput: InputsState = {
    text: input.inputText,
    attachments: [],
    imageSchedule: null,
    parsedText: [input.parsedText, ...facts].filter(Boolean).join("\n"),
    sourceType: input.sourceType
  };
  const analysis = mockAnalyzeInput(analysisInput);
  const options = mockGeneratePlanOptions(analysis);
  const missingInformation = detectMissingInformation(input.inputText, facts);
  // AGENTS.md flow: understand → ask → deal. We must NOT jump straight to
  // ready on the first turn just because the goal is "actionable" — that
  // skips the clarifying choice that makes the interaction interesting.
  // Build is only allowed when:
  //   1. there is no missing information, AND
  //   2. the user has already had at least one back-and-forth (so they have
  //      had the chance to make a choice via `asking`).
  // For first-turn submissions we always produce `needs-supplement` so the
  // chat route emits `next_phase=asking` with three real options.
  const userTurns = messages.filter((m) => m.role === "user").length;
  const hasFollowUp = userTurns >= 2;
  const shouldBuildNow = missingInformation.length === 0 && hasFollowUp;
  const status: PlanModeTurnResult["status"] = shouldBuildNow ? "ready-to-build" : "needs-supplement";
  const planOptions = shouldBuildNow
    ? [
        ...options.map((option) => ({
          id: option.id,
          label: option.name,
          kind: "build" as const,
          planId: option.id,
          description: option.summary
        })),
        {
          id: "supplement",
          label: "否，我要自己补充",
          kind: "supplement" as const,
          description: "用户补充时间、地点、约束或想保留的安排。"
        }
      ]
    : buildClarifyingOptions(input.inputText, facts, missingInformation);

  return {
    status,
    shouldBuildNow,
    analysis: {
      goalUnderstanding: analysis.goalUnderstanding,
      knownConstraints: [...analysis.constraints, ...facts.map((fact) => `上下文事实：${fact}`)],
      missingInformation,
      timeJudgement: buildTimeJudgement(input.inputText, analysis.deadlineLabel, facts),
      recommendedDealMode: input.sourceType === "image" || input.sourceType === "attachment" ? "review-before-deal" : "deal-first-card"
    },
    options: planOptions,
    context: {
      messagesUsed: messages.length,
      facts
    }
  };
}

function detectMissingInformation(text: string, facts: string[]) {
  const missing: string[] = [];
  const normalized = text.trim();
  const contextText = [normalized, ...facts].join(" ");
  const vagueGoal = /那个|这个|弄一下|处理一下|搞一下|东西/.test(normalized) || normalized.length <= 3;
  const hasTime = /(\d{1,2}:\d{2}|今晚|明天|今天|截止|ddl|deadline|课前|早八|周[一二三四五六日天])/.test(
    contextText
  );
  const hasSpecificGoalContext = !vagueGoal || isActionableGoalContext(contextText);

  if (!hasSpecificGoalContext) {
    missing.push("具体目标对象");
  }

  if (!hasTime && !isActionableCourseGoal(contextText)) {
    missing.push("截止或期望完成时间");
  }

  return missing;
}

function isActionableCourseGoal(text: string) {
  return /(高数|上课|课程|课表|教室)/.test(text);
}

function isActionableGoalContext(text: string) {
  return /(高数|上课|课程|课表|教室|考试|通知|作业|报告|论文|教材|错题|实验|提交)/.test(text);
}

function buildTimeJudgement(text: string, deadlineLabel: string, facts: string[]) {
  if (/(\d{1,2}:\d{2}|今晚|明天|今天|截止|ddl|deadline|课前|早八|周[一二三四五六日天])/.test(`${text} ${facts.join(" ")}`)) {
    return `已识别时间线索：${deadlineLabel}`;
  }

  return `没有明确时间时使用默认启动窗口：${deadlineLabel}`;
}

function extractFacts(messages: PlanModeMessage[]) {
  return messages
    .filter((message) =>
      /(\d{1,2}:\d{2}|地点|教室|截止|ddl|deadline|前到|前出门|早八|课前|周[一二三四五六日天]|高数|课程|考试|通知|教材|作业页|错题|资料|重点|担心|保底|复习)/.test(
        message.content
      )
    )
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-5);
}

type ClarifyingPlanOption = {
  id: string;
  label: string;
  kind: "build" | "supplement" | "default-build";
  description: string;
  planId?: never;
};

// Three real choices the user can act on, picked by what's actually missing.
// Each option's description points at the consequence ("下一张卡只问 X")
// rather than describing the option itself, matching the system prompt's
// guidance for clarifying questions.
function buildClarifyingOptions(
  text: string,
  facts: string[],
  missing: string[]
): ClarifyingPlanOption[] {
  const contextText = [text, ...facts].join(" ");
  const isCourse = /(高数|上课|课程|课表|教室|早八|课前|到课)/.test(contextText);
  const isDeadlineWork = /(交|提交|ddl|deadline|截止|今晚|今天|明天)/.test(contextText);
  const missingTime = missing.includes("截止或期望完成时间");

  if (isCourse) {
    return [
      {
        id: "course-go-now",
        label: "立刻出门",
        kind: "default-build",
        description: "下一张卡只问怎么最快到，不让你在路上想别的。"
      },
      {
        id: "course-collect",
        label: "整理材料后再走",
        kind: "default-build",
        description: "先 5 分钟收东西，再发一张路上提醒卡。"
      },
      {
        id: "course-buffer",
        label: "保留缓冲",
        kind: "default-build",
        description: "提前 15 分钟出门，留意外余地。"
      }
    ];
  }

  if (isDeadlineWork) {
    return [
      {
        id: "rush-min",
        label: "先做最低可交版",
        kind: "default-build",
        description: "用 10-15 分钟拿到一个能交的版本，剩下时间再优化。"
      },
      {
        id: "rush-priority",
        label: "只做最关键 3 点",
        kind: "default-build",
        description: "圈出 3 个核心点，其它后置，避免完美主义卡住。"
      },
      {
        id: "rush-checkpoint",
        label: "10 分钟节拍",
        kind: "default-build",
        description: "每 10 分钟一个小检查点，逼近 deadline 不发散。"
      }
    ];
  }

  if (missingTime) {
    return [
      {
        id: "time-now",
        label: "现在就开始",
        kind: "default-build",
        description: "下一张卡是 10 分钟内能做的最小动作，不再等。"
      },
      {
        id: "time-tonight",
        label: "今晚找一段做",
        kind: "default-build",
        description: "默认在 20:00 前后开一个 25 分钟的专注窗口。"
      },
      {
        id: "time-defer",
        label: "明早再做",
        kind: "default-build",
        description: "今天先冻结，明早第一件事推给你。"
      }
    ];
  }

  return [
    {
      id: "calm-outline",
      label: "先列大纲",
      kind: "default-build",
      description: "把任务结构写下来再补内容，不容易跑偏。"
    },
    {
      id: "calm-step",
      label: "先做第一步",
      kind: "default-build",
      description: "做一个最小动作，再判断下一步要不要继续。"
    },
    {
      id: "calm-defer",
      label: "先冻结",
      kind: "default-build",
      description: "现在不做，等会儿到点再 review。"
    }
  ];
}
