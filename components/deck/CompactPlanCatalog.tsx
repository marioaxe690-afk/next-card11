"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, CircleDot, Flame, Snowflake, X } from "lucide-react";
import type { PlanOption, TaskCard, TaskDeck, TaskFlowState } from "@/lib/types";

type CompactPlanCatalogProps = {
  deck: TaskDeck;
  taskFlow?: TaskFlowState | null;
  currentCardId?: string | null;
  planOptions?: PlanOption[];
  selectedPlanId?: string | null;
  selectedPlanName?: string;
  onSelectPlan?: (planId: PlanOption["id"]) => void;
  onClose?: () => void;
  onOpenCard?: (cardId: string) => void;
};

type CatalogGroup = {
  id: string;
  title: string;
  cards: TaskCard[];
  status: "completed" | "active" | "frozen" | "failed" | "queued";
};

const planTone: Record<PlanOption["style"], string> = {
  urgent: "快速",
  balanced: "稳妥",
  gentle: "低压"
};

export function CompactPlanCatalog({
  deck,
  taskFlow,
  currentCardId,
  planOptions = [],
  selectedPlanId,
  selectedPlanName,
  onSelectPlan,
  onClose
}: CompactPlanCatalogProps) {
  const completed = deck.cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const total = deck.cards.length || deck.totalCards;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const selectedOption = planOptions.find((option) => option.id === selectedPlanId);
  const groups = buildCatalogGroups(deck, taskFlow, currentCardId);
  const totalMinutes = deck.cards.reduce((sum, card) => sum + card.estimatedMinutes, 0);
  const status = getDeckStatusCopy(deck.deckStatus);

  return (
    <section className="relative z-10 flex max-h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem] border border-ink/10 bg-white/[0.8] p-3 text-ink shadow-[0_18px_46px_rgba(31,41,35,0.09)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/90 to-transparent" aria-hidden />
      <header className="relative z-10 shrink-0 px-1 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-fern/80">Task flow</div>
            <h2 className="mt-1 truncate text-[1.08rem] font-semibold leading-6 text-ink">{deck.coverTitle}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ring-1 ${status.className}`}>
              {status.label}
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="grid size-8 place-items-center rounded-full border border-ink/8 bg-white/72 text-ink/58 transition hover:bg-white"
                aria-label="关闭计划目录"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-[1rem] border border-ink/8 bg-white/56 p-3">
          <div className="flex items-center justify-between gap-3 text-[0.72rem] font-medium text-ink/48">
            <span className="truncate">{selectedOption?.summary ?? selectedPlanName ?? `${groups.length} 个阶段 · ${total} 张卡`}</span>
            <span className="shrink-0">{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0d3b2a,#4f7f63)]"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[0.68rem] font-semibold text-ink/42">
            <span>{completed}/{total} 已完成</span>
            <span>{totalMinutes} min</span>
          </div>
        </div>

        {planOptions.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-ink/8 bg-ink/[0.035] p-1">
            {planOptions.map((option) => {
              const selected = option.id === selectedPlanId;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSelectPlan?.(option.id)}
                  className={`h-8 min-w-0 rounded-full px-2 text-xs font-semibold transition ${
                    selected
                      ? "bg-white text-ink shadow-[0_4px_14px_rgba(31,41,35,0.08)] ring-1 ring-ink/8"
                      : "text-ink/48 hover:bg-white/54 hover:text-ink/70"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="block truncate">{planTone[option.style] ?? option.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="relative z-10 mt-3 min-h-0 overflow-y-auto pr-0.5">
        <div className="grid gap-1.5">
          {groups.map((group, index) => (
            <CatalogGroupRow key={group.id} group={group} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CatalogGroupRow({ group, index }: { group: CatalogGroup; index: number }) {
  const tone = getGroupTone(group.status);
  const Icon = tone.Icon;
  const minutes = group.cards.reduce((sum, card) => sum + card.estimatedMinutes, 0);

  return (
    <div className={`relative grid min-h-[56px] grid-cols-[1.7rem_minmax(0,1fr)_4.1rem] items-center gap-2 rounded-[0.9rem] px-2.5 py-2 ring-1 ${tone.row}`}>
      <span className={`grid size-5 place-items-center rounded-full border ${tone.icon}`}>
        <Icon size={11} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[0.68rem] font-semibold text-ink/36">{String(index + 1).padStart(2, "0")}</span>
          <span className="truncate text-[0.9rem] font-semibold leading-5 text-ink">{group.title}</span>
        </div>
        <div className="mt-0.5 truncate text-[0.68rem] font-medium text-ink/44">
          包含 {group.cards.length} 张卡 · {tone.label}
        </div>
      </div>
      <span className="justify-self-end rounded-full bg-white/62 px-2 py-1 text-[0.68rem] font-semibold text-ink/48">
        {minutes}m
      </span>
    </div>
  );
}

function buildCatalogGroups(deck: TaskDeck, taskFlow?: TaskFlowState | null, currentCardId?: string | null): CatalogGroup[] {
  if (!taskFlow?.nodes.length) {
    return [{
      id: deck.id,
      title: deck.coverTitle,
      cards: deck.cards,
      status: getGroupStatus(deck, deck.cards, currentCardId)
    }];
  }

  return taskFlow.nodes
    .map((node) => {
      const cards = deck.cards.filter((card) => card.flowNodeId === node.id);

      return {
        id: node.id,
        title: node.title,
        cards,
        status: getGroupStatus(deck, cards, currentCardId)
      };
    })
    .filter((group) => group.cards.length > 0);
}

function getGroupStatus(deck: TaskDeck, cards: TaskCard[], currentCardId?: string | null): CatalogGroup["status"] {
  if (deck.deckStatus === "failed") {
    return "failed";
  }

  if (deck.deckStatus === "frozen") {
    return "frozen";
  }

  if (cards.length > 0 && cards.every((card) => card.status === "completed" || card.status === "rewarded")) {
    return "completed";
  }

  if (cards.some((card) => card.id === currentCardId || card.status === "active")) {
    return "active";
  }

  return "queued";
}

function getDeckStatusCopy(status: TaskDeck["deckStatus"]) {
  if (status === "completed") {
    return { label: "已完成", className: "bg-moss/10 text-moss ring-moss/15" };
  }

  if (status === "frozen") {
    return { label: "已冻结", className: "bg-sky-50 text-sky-900 ring-sky-200/70" };
  }

  if (status === "failed") {
    return { label: "已失败", className: "bg-[#fff1e8] text-ember ring-ember/18" };
  }

  return { label: "进行中", className: "bg-ink/[0.055] text-ink/62 ring-ink/8" };
}

function getGroupTone(status: CatalogGroup["status"]) {
  if (status === "completed") {
    return {
      label: "已完成",
      row: "bg-white/48 ring-moss/12",
      icon: "border-moss/80 bg-moss text-white",
      Icon: Check
    };
  }

  if (status === "frozen") {
    return {
      label: "后台冻结",
      row: "bg-[linear-gradient(90deg,rgba(241,251,255,0.92),rgba(255,255,255,0.58))] ring-sky-200/52",
      icon: "border-sky-200 bg-white/80 text-sky-800 shadow-[0_0_14px_rgba(125,211,252,0.24)]",
      Icon: Snowflake
    };
  }

  if (status === "failed") {
    return {
      label: "任务失败",
      row: "bg-[linear-gradient(90deg,rgba(255,244,236,0.92),rgba(255,255,255,0.58))] ring-ember/18",
      icon: "border-ember/30 bg-white/80 text-ember shadow-[0_0_14px_rgba(231,120,75,0.2)]",
      Icon: Flame
    };
  }

  if (status === "active") {
    return {
      label: "当前阶段",
      row: "bg-ink/[0.055] ring-ink/8",
      icon: "border-ink bg-ink text-white",
      Icon: CircleDot
    };
  }

  return {
    label: "待开始",
    row: "bg-white/36 ring-ink/6",
    icon: "border-ink/16 bg-white/70 text-ink/40",
    Icon: AlertTriangle
  };
}
