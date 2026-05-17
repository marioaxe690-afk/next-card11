import type { ImportConflict, ImportCoverageCheck, ImportedTopLevelCard, ImportReviewResult, SourceType } from "@/lib/types";

export function createImportReview(input: { sourceType: SourceType; rawText: string }): ImportReviewResult {
  const lines = input.rawText
    .split(/\r?\n|；|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  const topLevelCards = lines
    .filter((line) => shouldBecomeTopLevelCard(line))
    .map((line, index): ImportedTopLevelCard => {
      const timeLabel = extractTimeLabel(line);
      const kind = classifyLine(line);

      return {
        id: `import-card-${index + 1}`,
        title: makeTitle(line, kind),
        sourceLine: line,
        timeLabel,
        kind,
        reviewStatus: "pending"
      };
    });
  const possibleOmissions = detectOmissions(input.rawText, topLevelCards.length);
  const conflicts = detectConflicts(topLevelCards);
  const coverageChecks = buildCoverageChecks(lines, topLevelCards, possibleOmissions, conflicts);
  const reviewRequired =
    input.sourceType !== "text" || topLevelCards.length > 1 || possibleOmissions.length > 0 || conflicts.length > 0;

  return {
    reviewRequired,
    topLevelCards,
    dealNowCards: topLevelCards.slice(0, 2),
    hiddenBacklogCards: topLevelCards.slice(2),
    coverageChecks,
    possibleOmissions,
    conflicts,
    userReviewPrompt: reviewRequired
      ? "请先检阅 AI 识别出的顶层牌清单，确认没有漏掉课程、截止或提醒，再进入发牌。"
      : "导入内容较小，可以直接建牌。"
  };
}

function shouldBecomeTopLevelCard(line: string) {
  return /(\d{1,2}:\d{2}|截止|ddl|deadline|提醒|通知|课|实验|作业|提交)/i.test(line);
}

function classifyLine(line: string): ImportedTopLevelCard["kind"] {
  if (/(截止|ddl|deadline|提交|前交|前提交|前完成|(?:今天|明天|今晚|周[一二三四五六日天])?\s*\d{1,2}:\d{2}\s*前)/i.test(line)) {
    return "deadline";
  }

  if (isTimetableCourseLine(line)) {
    return "course";
  }

  if (/(高数|大学英语|物理实验|体育课|实验课|课程|上课|seminar|lecture|lab|[\u4e00-\u9fffA-Za-z0-9]{1,16}课(?:\s|[，,。；]|$))/i.test(line)) {
    return "course";
  }

  if (/(提醒|通知|别忘|记得|检查|回复|打电话|签到)/.test(line)) {
    return "reminder";
  }

  return "task";
}

function isTimetableCourseLine(line: string) {
  const hasCalendarSlot = /(周[一二三四五六日天]|星期[一二三四五六日天]|第\d+节|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/.test(line);
  const hasCourseLikeSubject =
    /(大学物理|高等数学|综合英语|思想道德|法治|体育|篮球|形势与政策|学科前沿|线代|英语|物理|数学|课程|讲座)/.test(
      line
    );
  const isOperationalNotice = /(提醒|别忘|记得|检查|回复|打电话|签到|通知：)/.test(line) && !/课程群通知/.test(line);

  return hasCalendarSlot && hasCourseLikeSubject && !isOperationalNotice;
}

function extractTimeLabel(line: string) {
  const dateWeekdayTime = line.match(/((?:\d{1,2}月\d{1,2}日\s*)?周[一二三四五六日天]\s*(?:第\d+节\s*)?\d{1,2}:\d{2})/);
  if (dateWeekdayTime) {
    return dateWeekdayTime[1].replace(/\s+/g, " ");
  }

  const dateTime = line.match(/(\d{1,2}月\d{1,2}日\s*(?:第\d+节\s*)?\d{1,2}:\d{2})/);
  if (dateTime) {
    return dateTime[1].replace(/\s+/g, " ");
  }

  const relativeTime = line.match(/((?:今天|明天|今晚|早八|课前)?\s*\d{1,2}:\d{2})/);
  if (relativeTime) {
    return relativeTime[1].trim();
  }

  return undefined;
}

function makeTitle(line: string, kind: ImportedTopLevelCard["kind"]) {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const prefix = kind === "course" ? "课程" : kind === "deadline" ? "截止" : kind === "reminder" ? "提醒" : "任务";

  return `${prefix}：${cleaned.length > 32 ? `${cleaned.slice(0, 32)}...` : cleaned}`;
}

function detectOmissions(rawText: string, parsedCount: number) {
  const omissions: string[] = [];

  if (/(另有|还有|见附件|末尾|附表|以及)/.test(rawText) && parsedCount <= 2) {
    omissions.push("文本提示另有项目或见附件，可能还有未解析课程/截止/提醒。");
  }

  if (/(全天|每天|每周)/.test(rawText) && parsedCount <= 1) {
    omissions.push("文本包含重复/周期性安排，需要确认是否拆成多张顶层牌。");
  }

  return omissions;
}

function detectConflicts(cards: ImportedTopLevelCard[]): ImportConflict[] {
  const byTime = new Map<string, ImportedTopLevelCard[]>();
  for (const card of cards) {
    if (!card.timeLabel) {
      continue;
    }

    byTime.set(card.timeLabel, [...(byTime.get(card.timeLabel) ?? []), card]);
  }

  return Array.from(byTime.entries())
    .filter(([, items]) => items.length > 1)
    .map(([timeLabel, items]) => ({
      kind: "same-time-conflict" as const,
      timeLabel,
      itemIds: items.map((item) => item.id),
      detail: `${timeLabel} 出现 ${items.length} 个顶层项目，需要用户确认是否冲突或重复。`
    }));
}

function buildCoverageChecks(
  lines: string[],
  cards: ImportedTopLevelCard[],
  omissions: string[],
  conflicts: ImportConflict[]
): ImportCoverageCheck[] {
  return [
    {
      kind: "timetable-line-count",
      passed: cards.length >= Math.min(lines.length, 1),
      detail: `识别 ${cards.length} 个顶层项目 / ${lines.length} 行输入。`
    },
    {
      kind: "deadline-count",
      passed: cards.some((card) => card.kind === "deadline") || !lines.some((line) => /(截止|ddl|deadline|提交)/i.test(line)),
      detail: "检查截止/提交类项目是否进入顶层牌。"
    },
    {
      kind: "reminder-count",
      passed: cards.some((card) => card.kind === "reminder") || !lines.some((line) => /(提醒|通知)/.test(line)),
      detail: "检查提醒/通知类项目是否进入顶层牌。"
    },
    {
      kind: "conflict-scan",
      passed: conflicts.length === 0,
      detail: conflicts.length === 0 ? "未发现同时间冲突。" : "发现同时间冲突，需要 review。"
    },
    {
      kind: "omission-scan",
      passed: omissions.length === 0,
      detail: omissions.length === 0 ? "未发现明显遗漏提示词。" : omissions.join(" ")
    }
  ];
}
