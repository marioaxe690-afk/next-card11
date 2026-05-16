"use client";

import { Award, Clock3 } from "lucide-react";
import type { RewardCard as RewardCardType } from "@/lib/types";

export function RewardCard({ reward }: { reward: RewardCardType }) {
  return (
    <article className="rounded-[1.8rem] border border-gold/35 bg-[#fff8dd] p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 place-items-center rounded-full bg-[#c99d3e] text-white">
          <Award size={21} />
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink/62">reward</span>
      </div>
      <h3 className="mt-5 font-editorial text-[1.9rem] leading-tight text-ink">{reward.title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink/70">{reward.summary}</p>
      <div className="mt-4 flex items-center gap-2 rounded-[1rem] bg-white/66 px-3 py-2 text-sm font-semibold text-ink/72">
        <Clock3 size={15} />
        {reward.timePerformance}
      </div>
    </article>
  );
}
