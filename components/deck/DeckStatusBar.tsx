"use client";

import { Clock3, Gauge, Layers3 } from "lucide-react";
import type { TaskCard, TaskDeck } from "@/lib/types";

type DeckStatusBarProps = {
  deck: TaskDeck;
  card: TaskCard;
  elapsedSeconds: number;
};

export function DeckStatusBar({ deck, card, elapsedSeconds }: DeckStatusBarProps) {
  const remainingCards = Math.max(0, deck.totalCards - deck.completedCards);
  const progress = deck.totalCards === 0 ? 0 : Math.round((deck.completedCards / deck.totalCards) * 100);
  const remainingSeconds = card.remainingSeconds ?? Math.max(0, card.estimatedMinutes * 60 - elapsedSeconds);

  return (
    <div className="rounded-[1.15rem] border border-ink/10 bg-white/74 p-3 shadow-sm">
      <div className="grid gap-2 text-xs text-ink/66">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
            <Layers3 size={14} />
            <span className="truncate">{deck.coverTitle}</span>
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatusChip icon={Gauge} label="cards" value={`${deck.completedCards} done / ${remainingCards} left`} />
          <StatusChip icon={Clock3} label="time" value={`${Math.floor(elapsedSeconds / 60)}m elapsed / ${Math.ceil(remainingSeconds / 60)}m left`} />
        </div>
        <div className="rounded-[0.9rem] bg-ink/[0.045] px-3 py-2">
          <span className="font-semibold text-ink">Flow node</span>
          <span className="ml-2">{card.flowNodeId}</span>
          <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 font-semibold">{card.urgencyStage}</span>
        </div>
      </div>
    </div>
  );
}

function StatusChip({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[0.9rem] bg-ink/[0.045] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink/38">
        <Icon size={12} />
        {label}
      </div>
      <div className="mt-1 font-semibold text-ink/72">{value}</div>
    </div>
  );
}
