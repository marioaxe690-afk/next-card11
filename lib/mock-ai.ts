import type {
  AgentDecision,
  AgentId,
  AgentProfile,
  BehaviorVector,
  AnalysisResult,
  ClarificationAnswer,
  ClarifyingQuestion,
  InputsState,
  PlanOption,
  ProofRecord,
  SourceType,
  TaskCard,
  TaskDeck,
  TaskFlowState,
  ThinkingStep
} from "@/lib/types";

export const AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  "balanced-coach": {
    id: "balanced-coach",
    name: "平衡教练",
    role: "默认执行节奏",
    description: "在速度、细节和压力之间保持稳定推进。",
    policy: {
      strictness: 50,
      decomposition: 60,
      pushFrequency: 50,
      burnSensitivity: 50,
      freezeTolerance: 50,
      rewardEmphasis: 55,
      cardMinuteRange: [6, 12],
      tone: "balanced"
    }
  },
  "deadline-guardian": {
    id: "deadline-guardian",
    name: "截止线守卫",
    role: "保护最后行动窗口",
    description: "更早标记时间压力，用直接但不羞辱的方式提醒用户启动。",
    policy: {
      strictness: 82,
      decomposition: 58,
      pushFrequency: 84,
      burnSensitivity: 90,
      freezeTolerance: 32,
      rewardEmphasis: 62,
      cardMinuteRange: [4, 9],
      tone: "urgent"
    }
  },
  "micro-splitter": {
    id: "micro-splitter",
    name: "微动作拆解师",
    role: "降低开始门槛",
    description: "把模糊任务拆成更小的可开始动作，优先处理不知道怎么开始。",
    policy: {
      strictness: 28,
      decomposition: 95,
      pushFrequency: 58,
      burnSensitivity: 42,
      freezeTolerance: 72,
      rewardEmphasis: 68,
      cardMinuteRange: [3, 7],
      tone: "gentle"
    }
  },
  "sprint-driver": {
    id: "sprint-driver",
    name: "冲刺推进器",
    role: "先做最低可交付",
    description: "在拖延和 deadline 同时存在时，快速压出最低可行动作。",
    policy: {
      strictness: 76,
      decomposition: 78,
      pushFrequency: 82,
      burnSensitivity: 84,
      freezeTolerance: 40,
      rewardEmphasis: 72,
      cardMinuteRange: [4, 8],
      tone: "direct"
    }
  },
  "gentle-recovery": {
    id: "gentle-recovery",
    name: "温和恢复师",
    role: "拖延后重新接回任务",
    description: "把冻结、回避和低能量任务重新接回，不增加羞耻压力。",
    policy: {
      strictness: 20,
      decomposition: 82,
      pushFrequency: 34,
      burnSensitivity: 30,
      freezeTolerance: 92,
      rewardEmphasis: 76,
      cardMinuteRange: [4, 9],
      tone: "gentle"
    }
  },
  "meaning-coach": {
    id: "meaning-coach",
    name: "意义唤醒师",
    role: "补足任务价值感",
    description: "当任务价值感弱时，强调完成后能留下的证据和收益。",
    policy: {
      strictness: 40,
      decomposition: 66,
      pushFrequency: 44,
      burnSensitivity: 40,
      freezeTolerance: 66,
      rewardEmphasis: 90,
      cardMinuteRange: [5, 11],
      tone: "balanced"
    }
  }
};

const courseSignals = [
  "高数",
  "课程",
  "上课",
  "课表",
  "早八",
  "教室",
  "calculus",
  "lecture",
  "classroom",
  "course schedule",
  "lab schedule",
  "seminar"
];
const assignmentSignals = [
  "提交",
  "截止",
  "前交",
  "论文",
  "报告",
  "ddl",
  "deadline",
  "作业通知",
  "作业说明",
  "课程作业",
  "submit",
  "essay",
  "due",
  "report",
  "homework",
  "reflection",
  "paper"
];
const explicitAssignmentSignals = [
  "论文",
  "报告",
  "ddl",
  "deadline",
  "作业通知",
  "作业说明",
  "课程作业",
  "submit",
  "essay",
  "due",
  "report",
  "homework",
  "reflection",
  "paper"
];
const procrastinationSignals = [
  "拖",
  "拖了",
  "一直没",
  "一直不想",
  "不想开始",
  "没开始",
  "卡住",
  "来不及",
  "焦虑",
  "抗拒",
  "avoid",
  "stuck",
  "procrastinat"
];
const lowExpectancySignals = [
  "不知道怎么开始",
  "完全不知道",
  "不会",
  "没思路",
  "看不懂",
  "太难",
  "卡住",
  "confused",
  "stuck"
];
const lowValueSignals = ["随便", "不重要", "没意义", "可做可不做", "无所谓", "boring", "not important"];
const noPressureSignals = ["不着急", "不急", "没有截止", "无截止", "长期", "未来一个月", "later", "no deadline"];
const explicitTimeSignals = [
  "今晚",
  "明天",
  "今天",
  "ddl",
  "deadline",
  "due",
  "截止",
  "前",
  "早八",
  "08:00",
  "20:00",
  "下周",
  "课前"
];

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
  const hasText = Boolean(input.text.trim());
  const sourceCount = [hasText, hasAttachment, hasImage].filter(Boolean).length;

  if (sourceCount > 1) {
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

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getAgentProfile(agentId: AgentId): AgentProfile {
  return AGENT_PROFILES[agentId] ?? AGENT_PROFILES["balanced-coach"];
}

export function selectAgentForBehavior(vector: BehaviorVector): AgentDecision {
  if (vector.timePressure >= 82 && vector.procrastination >= 55 && vector.taskValue >= 60) {
    return {
      selectedAgentId: "sprint-driver",
      confidence: 0.9,
      reason: "拖延风险和截止压力同时偏高，需要先压出最低可行动作。"
    };
  }

  if (vector.timePressure >= 80 && vector.taskValue >= 55) {
    return {
      selectedAgentId: "deadline-guardian",
      confidence: 0.86,
      reason: "时间窗口正在收窄，适合用截止线守卫提前点亮燃烧提示。"
    };
  }

  if (vector.expectancy < 45 || vector.procrastination >= 78) {
    return {
      selectedAgentId: "micro-splitter",
      confidence: 0.82,
      reason: "成功预期偏低或卡住感较强，需要把任务拆到可马上开始。"
    };
  }

  if (vector.procrastination >= 60 && vector.timePressure < 50) {
    return {
      selectedAgentId: "gentle-recovery",
      confidence: 0.78,
      reason: "任务被回避但时间压力不高，适合温和恢复而不是加压。"
    };
  }

  if (vector.taskValue < 45) {
    return {
      selectedAgentId: "meaning-coach",
      confidence: 0.66,
      reason: "任务价值感偏弱，需要先把完成后的证据和收益说清楚。"
    };
  }

  return {
    selectedAgentId: "balanced-coach",
    confidence: 0.72,
    reason: "心理阻力和时间压力都在可控范围，适合平衡推进。"
  };
}

function isAssignmentLike(text: string) {
  const normalized = text.replace(/\s+/g, "");
  const lower = normalized.toLowerCase();
  const negatedHomework =
    /(不是|并不是|不要|别|不用|不需要).{0,12}(提交|交|写|做|完成)?作业/.test(normalized) ||
    /(不要|别|不用|不需要).{0,12}(提交|交).{0,12}作业/.test(normalized);
  const negatedDeadline =
    /(没有|无|不是|不需要|不用).{0,8}(硬)?(截止|deadline|ddl|due)/i.test(lower) ||
    /(有没有|是否有).{0,8}(硬)?(截止|deadline|ddl|due).{0,12}(没有|无|不是|不需要|不用)/i.test(lower);
  const hasExplicitAssignment = hasAny(text, explicitAssignmentSignals);

  if ((negatedHomework || negatedDeadline) && !hasExplicitAssignment) {
    return false;
  }

  if (hasAny(text, assignmentSignals)) {
    return true;
  }

  return /(^|[，。；,.!?！？、])(作业)($|[，。；,.!?！？、])/.test(text) || /(写|做|补|交|提交|完成).{0,12}作业/.test(normalized);
}

export function mockAnalyzeBehaviorVector(input: InputsState): BehaviorVector {
  const parsedText = [input.text, input.parsedText, input.imageSchedule?.parsedTimetable]
    .filter(Boolean)
    .join(" ");
  const text = parsedText || input.text || "";
  const isCourse = hasAny(text, courseSignals);
  const isAssignment = isAssignmentLike(text);
  const explicitTime = hasAny(text, explicitTimeSignals) || /\b\d{1,2}:\d{2}\b/.test(text);
  const saysNoPressure = hasAny(text, noPressureSignals);
  const avoids = hasAny(text, procrastinationSignals);
  const lowExpectancy = hasAny(text, lowExpectancySignals);
  const lowValue = hasAny(text, lowValueSignals);
  const reasons: string[] = [];

  let expectancy = 62;
  let taskValue = 52;
  let procrastination = 28;
  let timePressure = 34;

  if (isCourse) {
    expectancy += 22;
    taskValue += 26;
    timePressure += 54;
    reasons.push("课程类目标动作边界清楚，成功预期较高。");
    reasons.push("课程开始或出门窗口会抬高时间压力。");
  }

  if (isAssignment) {
    expectancy += 2;
    taskValue += 34;
    timePressure += explicitTime ? 50 : 28;
    procrastination += 10;
    reasons.push("作业/提交类输入有明确交付价值。");
  }

  if (explicitTime) {
    taskValue += 8;
    timePressure += 20;
    reasons.push("文本包含 deadline、课前或具体时间信号。");
  }

  if (saysNoPressure) {
    timePressure -= 40;
    reasons.push("输入说明不着急或属于长期窗口。");
  }

  if (avoids) {
    procrastination += 42;
    expectancy -= 10;
    reasons.push("出现拖延、回避或一直没开始的信号。");
  }

  if (lowExpectancy) {
    expectancy -= 28;
    procrastination += 18;
    reasons.push("出现不知道怎么开始或卡住的信号。");
  }

  if (lowValue) {
    taskValue -= 30;
    reasons.push("输入缺少价值信号，需要补完成后的证据感。");
  }

  if (!text.trim()) {
    expectancy -= 8;
    taskValue -= 12;
    timePressure -= 12;
    reasons.push("没有明确输入，先用温和默认时间建议。");
  }

  return {
    expectancy: clampScore(expectancy),
    taskValue: clampScore(taskValue),
    procrastination: clampScore(procrastination),
    timePressure: clampScore(timePressure),
    reasons: reasons.length > 0 ? reasons : ["输入可进入平衡推进：先做一个 10 分钟内能结束的小动作。"]
  };
}

export function mockAnalyzeInput(input: InputsState): AnalysisResult {
  const sourceType = detectSource(input);
  const parsedText = [input.text, input.parsedText, input.imageSchedule?.parsedTimetable]
    .filter(Boolean)
    .join(" ");
  const goal = normalizeGoal(input.text || input.parsedText || input.imageSchedule?.parsedTimetable || "");
  const isCourse = hasAny(parsedText, courseSignals);
  const isAssignment = isAssignmentLike(parsedText);
  const behaviorVector = mockAnalyzeBehaviorVector(input);
  const agentDecision = selectAgentForBehavior(behaviorVector);

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
      suggestedStart: "建议 25 分钟内启动",
      behaviorVector,
      agentDecision
    };
  }

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
      suggestedStart: "现在开始第一张卡",
      behaviorVector,
      agentDecision
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
    suggestedStart: "25 分钟内开始",
    behaviorVector,
    agentDecision
  };
}

function attachAgentPolicy(option: Omit<PlanOption, "agentId" | "agentName" | "agentPolicy">, agentId: AgentId): PlanOption {
  const agent = getAgentProfile(agentId);

  return {
    ...option,
    agentId,
    agentName: agent.name,
    agentPolicy: agent.policy
  };
}

function choosePlanAgents(analysis: AnalysisResult): [AgentId, AgentId, AgentId] {
  const recommended = analysis.agentDecision.selectedAgentId;
  const urgentAgent: AgentId =
    recommended === "deadline-guardian" || recommended === "sprint-driver" || recommended === "micro-splitter"
      ? recommended
      : analysis.behaviorVector.timePressure >= 70
        ? "deadline-guardian"
        : "sprint-driver";
  const balancedAgent: AgentId = recommended === "meaning-coach" ? "meaning-coach" : "balanced-coach";
  const gentleAgent: AgentId =
    recommended === "gentle-recovery" || analysis.behaviorVector.procrastination >= 60
      ? "gentle-recovery"
      : "micro-splitter";

  return [urgentAgent, balancedAgent, gentleAgent];
}

export function mockGeneratePlanOptions(analysis: AnalysisResult, clarificationAnswer?: ClarificationAnswer | null): PlanOption[] {
  const isCourse = analysis.goalUnderstanding.includes("出门") || analysis.goalUnderstanding.includes("到课");
  const planAgents = choosePlanAgents(analysis);
  const tighten = clarificationAnswer?.effect ?? "";
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
    attachAgentPolicy({
      id: "plan-1",
      name: "方案一",
      style: "urgent",
      summary: `先保护最小可行动作，适合时间紧或已经接近最佳窗口时使用。由${getAgentProfile(planAgents[0]).name}控制节奏。${tighten ? `结合补充：${tighten}` : ""}`.trim(),
      estimatedTime: isCourse ? "18 min" : "32 min",
      detailLevel: "high",
      steps: urgentSteps
    }, planAgents[0]),
    attachAgentPolicy({
      id: "plan-2",
      name: "方案二",
      style: "balanced",
      summary: `速度和完整度平衡，适合正常推进。由${getAgentProfile(planAgents[1]).name}维持节奏。${tighten ? `结合补充：${tighten}` : ""}`.trim(),
      estimatedTime: isCourse ? "28 min" : "45 min",
      detailLevel: "medium",
      steps: balancedSteps
    }, planAgents[1]),
    attachAgentPolicy({
      id: "plan-3",
      name: "方案三",
      style: "gentle",
      summary: `低压力版本，允许中途冻结。由${getAgentProfile(planAgents[2]).name}降低重启阻力。${tighten ? `结合补充：${tighten}` : ""}`.trim(),
      estimatedTime: isCourse ? "35 min" : "60 min",
      detailLevel: "low",
      steps: gentleSteps
    }, planAgents[2])
  ];
}

export function mockRegeneratePlanOptions(
  input: InputsState,
  previousOptions: PlanOption[],
  clarificationAnswer?: ClarificationAnswer | null
): PlanOption[] {
  const analysis = mockAnalyzeInput(input);
  const suffixes = ["更短启动", "更稳节奏", "更低压力"];

  return mockGeneratePlanOptions(analysis, clarificationAnswer).map((option, index) => ({
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
  goalTitle?: string
): TaskDeck {
  const agent = getAgentProfile(selectedPlan.agentId);
  const policy = selectedPlan.agentPolicy ?? agent.policy;
  const isCourse =
    Boolean(goalTitle?.includes("高数")) ||
    selectedPlan.steps.some((step) => step.includes("上课") || step.includes("教材") || step.includes("课程") || step.includes("教室"));
  const coverTitle = goalTitle || (isCourse ? "去高数课" : "今日推进");
  const deckId = makeId("deck");
  const titles = selectedPlan.steps.flatMap((step, index) => {
    if (isCourse) {
      return index === 0
        ? ["确认高数课时间和教室", "整理高数课本和上次作业页"]
        : [step];
    }

    if (policy.decomposition >= 75 && index === 0) {
      return [step, "写下最低可完成版本的边界", "只完成第一个可交片段"];
    }

    if (policy.decomposition >= 85 && index === 1) {
      return [step, "保存当前证据并标记下一步"];
    }

    return index === 0 ? [step, "写下最低可完成版本的边界"] : [step];
  });

  const cards: TaskCard[] = titles.slice(0, 6).map((title, index) => {
    const nearDeadline = isCourse && index === 0;
    const estimatedMinutes = getPolicyEstimatedMinutes(index, nearDeadline, policy.cardMinuteRange);
    return {
      id: makeId("card"),
      deckId,
      agentId: agent.id,
      agentName: agent.name,
      flowNodeId: taskFlow.nodes[Math.min(index, taskFlow.nodes.length - 1)]?.id ?? taskFlow.nodes[0].id,
      title,
      action: makeAction(title),
      estimatedMinutes,
      deadlineAt: nearDeadline ? addMinutes(8) : index < 2 ? addMinutes(45 + index * 12) : null,
      suggestedStartAt: index === 0 ? nowIso() : addMinutes(index * 12),
      startedAt: null,
      elapsedSeconds: 0,
      remainingSeconds: nearDeadline ? 480 : null,
      urgencyStage: nearDeadline ? "burning" : index === 1 ? "warm" : "calm",
      damageEffect: nearDeadline ? "burn" : "none",
      damageProgress: nearDeadline ? 68 : 0,
      burnLevel: nearDeadline ? 3 : 0,
      status: index === 0 ? "active" : "queued",
      encouragement: makeEncouragement(agent.id, nearDeadline),
      cardBackNote: makeCardBackNote(agent.id, nearDeadline)
    };
  });

  return {
    id: deckId,
    coverTitle,
    coverIcon: isCourse ? "course" : "spark",
    agentId: agent.id,
    agentName: agent.name,
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
    cardBackNote: `已保留在「${taskFlow.title}」里，适合 3 小时后重新打开并稍后恢复上下文。`
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
  const agentIds = proofs.map((proof) => proof.agentId).filter(Boolean) as AgentId[];
  const leadingAgent = agentIds.length > 0 ? getAgentProfile(agentIds[0]) : null;
  const agentSentence = leadingAgent
    ? ` 当前主要推进风格是${leadingAgent.name}，它会影响拆解粒度、提醒频率和时间压力阈值。`
    : "";

  return `今天你已经留下 ${proofs.length} 条行动证据，其中 ${completed} 个目标进入完成或奖励状态，${frozen} 张卡片被温柔冻结，${failed} 个任务已燃烧锁定。你在 ${burning} 张卡片上使用了燃烧节奏，最适合继续推进的是 10 分钟内能结束的小任务。${agentSentence}`;
}

function getPolicyEstimatedMinutes(index: number, nearDeadline: boolean, range: [number, number]) {
  const [min, max] = range;
  const base = nearDeadline ? 4 : index % 2 === 0 ? 8 : 10;

  return Math.max(min, Math.min(max, base));
}

function makeEncouragement(agentId: AgentId, nearDeadline: boolean) {
  if (nearDeadline) {
    return agentId === "deadline-guardian"
      ? "先保护这个时间窗口，后面会变轻。"
      : "先做这一小步，后面会变轻。";
  }

  if (agentId === "gentle-recovery") {
    return "这张卡只需要重新接上线索，不需要一次补完。";
  }

  if (agentId === "micro-splitter") {
    return "只完成一个微动作就算推进。";
  }

  if (agentId === "meaning-coach") {
    return "完成后会留下可见证据，而不是只多一个 Todo。";
  }

  return "这张卡只需要一个明确动作。";
}

function makeCardBackNote(agentId: AgentId, nearDeadline: boolean) {
  if (nearDeadline) {
    return "你不是在赶完整目标，只是在保护最佳行动窗口。";
  }

  if (agentId === "sprint-driver") {
    return "冲刺只追求最低可行动作，润色可以放到后面的卡。";
  }

  if (agentId === "gentle-recovery") {
    return "继续或冻结都可以，系统会保存上下文，稍后可以温和恢复。";
  }

  if (agentId === "meaning-coach") {
    return "这一步的价值是把模糊目标变成 proof 里可读的一条证据。";
  }

  return "继续或冻结都可以，系统会保存上下文。";
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

  if (title.includes("第一个可交片段")) {
    return "只写最小可交付片段，不补背景，不做排版。";
  }

  if (title.includes("保存当前证据")) {
    return "保存当前文件或截图，并写下一句下一步要做什么。";
  }

  return "完成这一步里最小、最明确的动作，然后立刻进入下一张卡。";
}

function formatDeadline(iso: string) {
  const deadline = new Date(iso);
  const minutes = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 60000));
  return minutes > 0 ? `剩 ${minutes} min` : "窗口已过";
}

export function mockGenerateThinkingSteps(input: InputsState, analysis: AnalysisResult): ThinkingStep[] {
  const steps: ThinkingStep[] = [
    {
      id: `think-understand-${Date.now()}`,
      role: "ai",
      tone: "understanding",
      text: `先把目标读一遍：${analysis.goalUnderstanding}`
    }
  ];

  if (analysis.constraints.length > 0) {
    steps.push({
      id: `think-constraints-${Date.now() + 1}`,
      role: "ai",
      tone: "time",
      text: `约束已记下：${analysis.constraints.slice(0, 2).join("、")}`
    });
  }

  if (analysis.timeStrategy.length > 0) {
    steps.push({
      id: `think-time-${Date.now() + 2}`,
      role: "ai",
      tone: "time",
      text: analysis.timeStrategy[0]
    });
  }

  steps.push({
    id: `think-confirm-${Date.now() + 3}`,
    role: "ai",
    tone: "confirmation",
    text: input.text.trim() ? "我去拆三套方案，再请你挑一套。" : "等你补一句目标，我立刻拆方案。"
  });

  return steps;
}

export function mockGenerateClarifyingQuestion(input: InputsState, analysis: AnalysisResult): ClarifyingQuestion {
  const goal = analysis.goalUnderstanding;
  const isCourse = goal.includes("出门") || goal.includes("到课");
  const hasTimePressure = analysis.behaviorVector.timePressure >= 60;

  const baseQuestion = isCourse
    ? "上课前你最想优先做什么？"
    : hasTimePressure
      ? "时间紧，先保哪一块？"
      : "下面这件事，怎么开始最合适？";

  const options = isCourse
    ? [
        { id: "course-go-now", label: "立刻出门", effect: "把当前节奏定为冲刺出门，路上做最低准备。" },
        { id: "course-collect", label: "整理材料后再走", effect: "先 5 分钟整理材料，再设置路上提醒。" },
        { id: "course-buffer", label: "保留缓冲", effect: "提前 15 分钟出门，留出意外缓冲。" }
      ]
    : hasTimePressure
      ? [
          { id: "rush-min", label: "先做最低可交版本", effect: "用 10-15 分钟拿到一个能交的版本。" },
          { id: "rush-priority", label: "只做最关键 3 点", effect: "圈出 3 个核心点，其它后置。" },
          { id: "rush-checkpoint", label: "每 10 分钟检查一次", effect: "用 10 分钟节拍逼近 deadline。" }
        ]
      : [
          { id: "calm-outline", label: "先列大纲再写", effect: "把任务结构写下，再补内容。" },
          { id: "calm-step", label: "先做第一步看看", effect: "做第一步，再判断下一步。" },
          { id: "calm-defer", label: "先冻结，等会再做", effect: "进入冻结，到时再 review。" }
        ];

  return {
    id: `clarify-${Date.now()}`,
    question: baseQuestion,
    options,
    defaultOptionId: options[0].id
  };
}
