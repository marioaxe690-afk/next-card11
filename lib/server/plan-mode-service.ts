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
  const contextText = [input.inputText, ...facts].join(" ");
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
  const shouldBuildNow = missingInformation.length === 0 || isActionableCourseGoal(contextText);
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
    : [
        {
          id: "default-build",
          label: "先按默认建牌",
          kind: "default-build" as const,
          description: "使用默认时间窗口和最小行动卡，先生成第一张牌。"
        },
        {
          id: "supplement",
          label: "否，我要自己补充",
          kind: "supplement" as const,
          description: "补充具体目标、截止时间或不可改安排。"
        }
      ];

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
