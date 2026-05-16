"use client";

import { CheckCircle2, Clock3, Layers3 } from "lucide-react";
import type { TaskCard } from "@/lib/types";

export function CardTimeUI({
  card,
  cardLabel,
  deckProgress
}: {
  card: TaskCard;
  cardLabel: string;
  deckProgress: number;
}) {
  const progress = Math.min(100, Math.max(0, deckProgress));

  return (
    <div className="rounded-full border border-ink/8 bg-white/68 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[0.72rem] font-semibold text-ink/62">
        <span className="flex items-center gap-1.5">
          <Clock3 size={13} />
          {card.estimatedMinutes}m
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <Layers3 size={14} />
          <span className="truncate">{cardLabel}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink/8 px-2 py-0.5">
          <CheckCircle2 size={12} />
          {progress}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/8">
        <div
          className={`h-full rounded-full ${card.damageEffect === "burn" ? "burn-rail" : "bg-moss"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
