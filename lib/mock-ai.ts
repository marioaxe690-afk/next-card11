import type {
  AnalysisResult,
  InputsState,
  PlanOption,
  ProofRecord,
  SourceType,
  TaskCard,
  TaskDeck,
  TaskFlowState
} from "@/lib/types";

const courseSignals = ["高数", "课程", "上课", "课表", "早八", "教室"];
const assignmentSignals = ["作业", "提交", "截止", "论文", "报告", "ddl", "deadline"];

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const addMinutes = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

function detectSource(input: InputsState): SourceType {
  const hasAttachment = input.attachments.length > 0;
  const hasImage = Boolean(input.imageSchedule);

  if ((hasAttachment || hasImage) && input.text.trim()) {
    return "mixed";
  }

  if (hasImage) {
    return "image";
  }

  if (hasAttachment) {
    return "attachment";
  }

  return "text";
}

function normalizeGoal(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    return "整理今天最需要推进的一件事";
  }

  return trimmed.length > 28 ? `${trimmed.slice(0, 28)}...` : trimmed;
}

function hasAny(text: string, signals: string[]) {
  const lower = text.toLowerCase();
  return signals.some((signal) => lower.includes(signal.toLowerCase()));
}

export function mockAnalyzeInput(input: InputsState): AnalysisResult {
  const sourceType = detectSource(input);
  const parsedText = [input.text, input.parsedText, input.imageSchedule?.parsedTimetable]
    .filter(Boolean)
    .join(" ");
  const goal = normalizeGoal(input.text || input.parsedText || input.imageSchedule?.parsedTimetable || "");
  const isCourse = hasAny(parsedText, courseSignals);
  const isAssignment = hasAny(parsedText, assignmentSignals);

  if (isCourse) {
    return {
      sourceType,
      goalUnderstanding: `你想把「${goal}」从一句提醒变成可以马上执行的出门/到课卡组。重点不是“记得上课”，而是把准备、离开、到达和课前缓冲拆开。`,
      constraints: [
        "课程开始前需要留出整理物品和路上缓冲",
        "第一张卡适合做成近截止燃烧演示，帮助快速启动",
        "如果错过最佳出门窗口，需要进入温柔重排而不是失败提示"
      ],
      stages: ["确认课程信息", "整理材料", "出门移动", "到达后课前准备"],
      timeStrategy: [
        "现在先完成 3 分钟内的物品确认",
        "路上任务只保留必须动作，避免长文本任务",
        "如果窗口错过，把当前卡冻结并生成下一次课前提醒"
      ],
      deadlineLabel: "还有 18 分钟到最佳出门窗口",
      availableWindow: "现在到课前 20 分钟",
      suggestedStart: "现在开始第一张卡"
    };
  }

  if (isAssignment) {
    return {
      sourceType,
      goalUnderstanding: `你要把「${goal}」变成一组最低可提交优先的行动卡。系统会先保护交付线，再处理润色和检查。`,
      constraints: [
        "存在提交截止或隐含截止，先做可交版本",
        "需要把阅读要求、输出草稿、检查格式分开",
        "高压力阶段允许燃烧模式，但不自动判失败"
      ],
      stages: ["读要求", "做最低可交版本", "补充关键细节", "提交前检查"],
      timeStrategy: [
        "先用 10 分钟确认必须提交点",
        "把可延后润色放进稍后推进卡",
        "截止前 10 分钟自动提高到 hot / burning"
      ],
      deadlineLabel: "今晚 20:00 前",
      availableWindow: "今天晚饭前到 20:00",
      suggestedStart: "建议 25 分钟内启动"
    };
  }

  return {
    sourceType,
    goalUnderstanding: `你想推进「${goal}」。我会先识别可马上开始的最小动作，再把后续动作放进轻量卡组。`,
    constraints: [
      "输入里没有明确截止时间，使用温和默认时间建议",
      "第一步必须足够小，避免把目标直接变成 Todo",
      "后续卡片需要保留冻结和重新安排路径"
    ],
    stages: ["确认目标边界", "启动最小动作", "连续推进", "收尾留证"],
    timeStrategy: [
      "默认建议 25 分钟内开始第一张卡",
      "把 10 分钟内可完成的动作放在前面",
      "低能量时选择 gentle 方案并允许冻结"
    ],
    deadlineLabel: "今天内完成第一轮推进",
    availableWindow: "接下来 25-45 分钟",
    suggestedStart: "25 分钟内开始"
  };
}

export function mockGeneratePlanOptions(analysis: AnalysisResult): PlanOption[] {
  const isCourse = analysis.goalUnderstanding.includes("出门") || analysis.goalUnderstanding.includes("到课");
  const urgentSteps = isCourse
    ? ["确认上课时间和地点", "把教材、笔、上次作业页放进包里", "立刻出门并保留 5 分钟缓冲", "到教室后打开今天要用的页面"]
    : ["圈出必须完成的 3 个点", "用 10 分钟做最低可交版本", "补上一个最关键细节", "快速检查并提交或保存证据"];
  const balancedSteps = isCourse
    ? ["确认课程和路线", "整理学习材料", "设置出门提醒并准备离开", "课前 3 分钟复盘上次内容"]
    : ["读一遍要求", "拆出主要段落或模块", "完成主体草稿", "检查格式和遗漏"];
  const gentleSteps = isCourse
    ? ["只确认下一步要去哪", "慢速整理必带物品", "给自己留出可冻结缓冲", "到达后做一个轻量开场动作"]
    : ["写下任务边界", "只做第一个小段", "冻结不必要分支", "留下下一次继续的上下文"];

  return [
    {
      id: "plan-1",
      name: "方案一",
      style: "urgent",
      summary: "先保护最小可行动作，适合时间紧或已经接近最佳窗口时使用。",
      estimatedTime: isCourse ? "18 min" : "32 min",
      detailLevel: "high",
      steps: urgentSteps
    },
    {
      id: "plan-2",
      name: "方案二",
      style: "balanced",
      summary: "速度和完整度平衡，适合正常推进，卡片节奏更稳定。",
      estimatedTime: isCourse ? "28 min" : "45 min",
      detailLevel: "medium",
      steps: balancedSteps
    },
    {
      id: "plan-3",
      name: "方案三",
      style: "gentle",
      summary: "低压力版本，允许中途冻结，适合疲劳、焦虑或长期目标。",
      estimatedTime: isCourse ? "35 min" : "60 min",
      detailLevel: "low",
      steps: gentleSteps
    }
  ];
}

export function mockRegeneratePlanOptions(input: InputsState, previousOptions: PlanOption[]): PlanOption[] {
  const analysis = mockAnalyzeInput(input);
  const suffixes = ["更短启动", "更稳节奏", "更低压力"];

  return mockGeneratePlanOptions(analysis).map((option, index) => ({
    ...option,
    summary: `${option.summary} 这次重新生成会偏向${suffixes[index]}。`,
    estimatedTime:
      option.id === "plan-1"
        ? previousOptions[0]?.estimatedTime === "18 min"
          ? "15 min"
          : option.estimatedTime
        : option.estimatedTime,
    steps: option.steps.map((step, stepIndex) => (stepIndex === 0 ? `${step}，并写下下一步` : step))
  }));
}

export function mockGenerateTaskFlow(selectedPlan: PlanOption): TaskFlowState {
  const labels = selectedPlan.style === "urgent" ? ["还有 18 分钟", "还有 12 分钟", "最后窗口"] : ["25 分钟内", "今晚前", "收尾前"];

  return {
    title: `${selectedPlan.name}任务流`,
    overallProgress: 0,
    nodes: selectedPlan.steps.slice(0, 4).map((step, index) => ({
      id: `flow-${selectedPlan.id}-${index + 1}`,
      title: step,
      status: index === 0 ? "active" : index === 3 && selectedPlan.style === "gentle" ? "frozen" : "not-started",
      progress: index === 0 ? 12 : 0,
      timeLabel: labels[index] || "稍后",
      urgencyStage: selectedPlan.style === "urgent" && index <= 1 ? "hot" : "calm"
    })),
    edges: [
      { from: `flow-${selectedPlan.id}-1`, to: `flow-${selectedPlan.id}-2` },
      { from: `flow-${selectedPlan.id}-2`, to: `flow-${selectedPlan.id}-3` },
      { from: `flow-${selectedPlan.id}-3`, to: `flow-${selectedPlan.id}-4` }
    ]
  };
}

export function mockGenerateDeckFromPlan(
  selectedPlan: PlanOption,
  taskFlow: TaskFlowState,
  goalTitle: string
): TaskDeck {
  const isCourse = goalTitle.includes("高数") || selectedPlan.steps.some((step) => step.includes("课程") || step.includes("教室"));
  const deckId = makeId("deck");
  const titles = selectedPlan.steps.flatMap((step, index) => {
    if (isCourse) {
      return index === 0
        ? ["确认高数课时间和教室", "整理高数课本和上次作业页"]
        : [step];
    }

    return index === 0 ? [step, "写下最低可完成版本的边界"] : [step];
  });

  const cards: TaskCard[] = titles.slice(0, 6).map((title, index) => {
    const nearDeadline = isCourse && index === 0;
    return {
      id: makeId("card"),
      deckId,
      flowNodeId: taskFlow.nodes[Math.min(index, taskFlow.nodes.length - 1)]?.id ?? taskFlow.nodes[0].id,
      title,
      action: makeAction(title),
      estimatedMinutes: nearDeadline ? 4 : index % 2 === 0 ? 8 : 10,
      deadlineAt: nearDeadline ? addMinutes(8) : index < 2 ? addMinutes(45 + index * 12) : null,
      suggestedStartAt: index === 0 ? nowIso() : addMinutes(index * 12),
      startedAt: null,
      elapsedSeconds: 0,
      remainingSeconds: nearDeadline ? 480 : null,
      urgencyStage: nearDeadline ? "hot" : index === 1 ? "warm" : "calm",
      damageEffect: "none",
      damageProgress: nearDeadline ? 18 : 0,
      burnLevel: 0,
      status: index === 0 ? "active" : "queued",
      encouragement: nearDeadline ? "先做这一小步，后面会变轻。" : "这张卡只需要一个明确动作。",
      cardBackNote: nearDeadline ? "你不是在赶完整目标，只是在保护最佳行动窗口。" : "继续或冻结都可以，系统会保存上下文。"
    };
  });

  return {
    id: deckId,
    coverTitle: goalTitle || (isCourse ? "去高数课" : "今日推进"),
    coverIcon: isCourse ? "course" : "spark",
    deckStatus: "new",
    cards,
    totalCards: cards.length,
    completedCards: 0
  };
}

export function mockGenerateTimePlanForCard(card: TaskCard) {
  if (card.deadlineAt) {
    return {
      windowLabel: formatDeadline(card.deadlineAt),
      urgencyStage: card.urgencyStage
    };
  }

  return {
    windowLabel: card.suggestedStartAt ? "建议现在开始" : "今天内",
    urgencyStage: card.urgencyStage
  };
}

export function mockUpdateCardUrgency(card: TaskCard, now: Date): TaskCard {
  if (!card.deadlineAt) {
    return card;
  }

  const seconds = Math.floor((new Date(card.deadlineAt).getTime() - now.getTime()) / 1000);

  if (seconds <= 0) {
    return {
      ...card,
      urgencyStage: "expired",
      damageEffect: "crack",
      burnLevel: 0,
      remainingSeconds: 0,
      damageProgress: 100
    };
  }

  if (seconds <= 180) {
    return { ...card, urgencyStage: "burning", damageEffect: "burn", burnLevel: 3, remainingSeconds: seconds, damageProgress: 86 };
  }

  if (seconds <= 1200) {
    return { ...card, urgencyStage: "hot", damageEffect: "burn", burnLevel: 2, remainingSeconds: seconds, damageProgress: 52 };
  }

  return { ...card, urgencyStage: "calm", remainingSeconds: seconds };
}

export function mockRescheduleFrozenCard(card: TaskCard, taskFlow: TaskFlowState): TaskCard {
  return {
    ...card,
    status: "frozen",
    damageEffect: "freeze",
    urgencyStage: "calm",
    burnLevel: 0,
    suggestedStartAt: addMinutes(180),
    cardBackNote: `已保留在「${taskFlow.title}」里，适合 3 小时后重新打开。`
  };
}

export function mockGenerateProofSummary(proofs: ProofRecord[]) {
  if (proofs.length === 0) {
    return "还没有形成证明记录。生成一个执行方案后，这里会开始记录目标、时间状态、冻结和奖励事件。";
  }

  const completed = proofs.filter((proof) => proof.status === "completed" || proof.status === "rewarded").length;
  const frozen = proofs.filter((proof) => proof.status === "frozen").length;
  const failed = proofs.filter((proof) => proof.status === "failed").length;
  const burning = proofs.filter((proof) => proof.timeStatus === "burning-completed").length;

  return `今天你已经留下 ${proofs.length} 条行动证据，其中 ${completed} 个目标完成，${frozen} 个任务被冻结，${failed} 个任务燃烧失败。你在 ${burning} 张卡片上使用过燃烧节奏，后台会优先显示任务级记录。`;
}

function makeAction(title: string) {
  if (title.includes("确认")) {
    return "打开来源信息，圈出时间、地点和必须完成的一个动作。";
  }

  if (title.includes("整理")) {
    return "只拿必须物品，放到一个固定位置，不扩展整理范围。";
  }

  if (title.includes("最低")) {
    return "用 10 分钟写出最低可提交版本，不做润色。";
  }

  return "完成这一步里最小、最明确的动作，然后立刻进入下一张卡。";
}

function formatDeadline(iso: string) {
  const deadline = new Date(iso);
  const minutes = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 60000));
  return minutes > 0 ? `剩 ${minutes} min` : "窗口已过";
}
