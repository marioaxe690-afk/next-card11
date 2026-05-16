"use client";

import { BookOpen, CheckCircle2, Flame, Snowflake } from "lucide-react";
import type { PlanOption, TaskDeck, TaskFlowNode, TaskFlowState } from "@/lib/types";

type PlanCatalogPreviewProps = {
  taskFlow: TaskFlowState | null;
  deck?: TaskDeck;
  selectedPlan?: PlanOption;
  compact?: boolean;
  onOpen: () => void;
  onNodeOpen?: (nodeId: string) => void;
};

const nodeTones = [
  "bg-[#ffe08a] text-ink",
  "bg-[#bfe9cf] text-ink",
  "bg-[#ffd1bd] text-ink",
  "bg-[#c9defd] text-ink"
];

export function PlanCatalogPreview({
  taskFlow,
  deck,
  selectedPlan,
  compact = false,
  onOpen,
  onNodeOpen
}: PlanCatalogPreviewProps) {
  const nodes = taskFlow?.nodes ?? [];
  const total = deck?.totalCards ?? nodes.length;
  const completed = deck?.completedCards ?? nodes.filter((node) => node.status === "completed" || node.status === "rewarded").length;
  const progress = total === 0 ? taskFlow?.overallProgress ?? 0 : Math.round((completed / total) * 100);
  const visibleNodes = nodes.slice(0, compact ? 3 : 4);

  return (
    <section className="relative overflow-hidden rounded-[1.35rem] border border-ink/10 bg-[#fff0b8] p-3 shadow-card">
      <div className="pointer-events-none absolute inset-2 rounded-[1.05rem] border border-white/40" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/52">
            <BookOpen size={13} />
            plan catalog
          </div>
          <h2 className="mt-1 truncate font-editorial text-[1.42rem] leading-tight text-ink">
            {taskFlow?.title ?? "计划任务总览"}
          </h2>
          <p className="mt-1 truncate text-xs font-semibold text-ink/58">
            {selectedPlan?.name ?? "当前方案"} · {selectedPlan?.summary ?? "进入 deck 前先看目录"}
          </p>
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white"
          aria-label="打开计划目录"
        >
          {progress}%
        </button>
      </div>

      <div className="relative z-10 mt-3 h-1.5 overflow-hidden rounded-full bg-white/72">
        <div className="h-full rounded-full bg-ink" style={{ width: `${progress}%` }} />
      </div>

      <div className="relative z-10 mt-3 grid gap-2">
        {visibleNodes.map((node, index) => (
          <CatalogNodeRow
            key={node.id}
            node={node}
            index={index}
            deck={deck}
            onClick={onNodeOpen ? () => onNodeOpen(node.id) : onOpen}
          />
        ))}
      </div>
    </section>
  );
}

function CatalogNodeRow({
  node,
  index,
  deck,
  onClick
}: {
  node: TaskFlowNode;
  index: number;
  deck?: TaskDeck;
  onClick: () => void;
}) {
  const cards = deck?.cards.filter((card) => card.flowNodeId === node.id) ?? [];
  const done = cards.length > 0
    ? cards.every((card) => card.status === "completed" || card.status === "rewarded")
    : node.status === "completed" || node.status === "rewarded";
  const frozen = cards.some((card) => card.status === "frozen" || card.damageEffect === "freeze") || node.status === "frozen";
  const burning = cards.some((card) => card.urgencyStage === "burning" || card.damageEffect === "burn") || node.urgencyStage === "burning";
  const tone = done ? "bg-white/40 text-ink/40" : nodeTones[index % nodeTones.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`grid grid-cols-[1.9rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.95rem] px-3 py-2 text-left ${tone}`}
    >
      <span className={`font-editorial text-[1.15rem] leading-none ${done ? "line-through" : ""}`}>
        0{index + 1}
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-sm font-semibold leading-5 ${done ? "line-through" : ""}`}>{node.title}</span>
        <span className="mt-0.5 block truncate text-[0.66rem] font-semibold uppercase tracking-[0.08em] opacity-60">
          {cards.length || 1} cards · {node.progress}%
        </span>
      </span>
      <span className="flex items-center gap-1">
        {done && <CheckCircle2 size={13} />}
        {frozen && <Snowflake size={13} />}
        {burning && <Flame size={13} />}
      </span>
    </button>
  );
}
