import type { ProofRecord, RewardCard } from "@/lib/types";

export type ProofExportPayload = {
  records: ProofRecord[];
  rewardCards?: RewardCard[];
  summaryDocument: string;
};

export function exportProofMarkdown(payload: ProofExportPayload) {
  const rows = payload.records
    .map((record) =>
      [
        `## ${record.goalTitle}`,
        `- 状态: ${record.status}`,
        `- 进度: ${record.progress}%`,
        `- 完成卡片: ${record.completedCards}`,
        `- 冻结卡片: ${record.frozenCards}`,
        `- 实际用时: ${record.actualMinutes} 分钟`,
        `- 时间状态: ${record.timeStatus}`,
        `- 最近行动: ${record.lastAction}`,
        `- 下一步建议: ${record.nextSuggestion}`,
        `- 时间/损伤记录: ${record.timeDamageEvents.join("；") || "无"}`
      ].join("\n")
    )
    .join("\n\n");
  const rewards = (payload.rewardCards ?? [])
    .map((reward) => `- ${reward.title}: ${reward.timePerformance}，实际 ${reward.actualMinutes} 分钟。${reward.summary}`)
    .join("\n");

  return [
    "# Next Card Proof",
    "",
    "## Summary",
    payload.summaryDocument || "暂无 summary。",
    "",
    "## Records",
    rows || "暂无 proof 记录。",
    "",
    "## Reward Cards",
    rewards || "暂无奖励卡。"
  ].join("\n");
}

export function exportProofJson(payload: ProofExportPayload) {
  return JSON.stringify(
    {
      schemaVersion: "next-card-proof-export/v1",
      exportedAt: new Date().toISOString(),
      records: payload.records,
      rewardCards: payload.rewardCards ?? [],
      summaryDocument: payload.summaryDocument
    },
    null,
    2
  );
}
