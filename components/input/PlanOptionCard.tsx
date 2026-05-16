"use client";

import { Flame, Leaf, Scale } from "lucide-react";
import type { PlanOption } from "@/lib/types";

const styleMeta = {
  urgent: {
    label: "rapid",
    Icon: Flame,
    className: "border-ember/28 bg-[#fff3ea]"
  },
  balanced: {
    label: "balanced",
    Icon: Scale,
    className: "border-moss/18 bg-white/72"
  },
  gentle: {
    label: "gentle",
    Icon: Leaf,
    className: "border-ice/80 bg-[#f1fbfb]"
  }
} as const;

type PlanOptionCardProps = {
  option: PlanOption;
  buttonLabel: string;
  selected: boolean;
  onSelect: (id: PlanOption["id"]) => void;
};

export function PlanOptionCard({ option, buttonLabel, selected, onSelect }: PlanOptionCardProps) {
  const meta = styleMeta[option.style];
  const Icon = meta.Icon;

  return (
    <article
      className={`rounded-[1.45rem] border p-4 shadow-sm transition ${meta.className} ${
        selected ? "ring-2 ring-ink/70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/52">
            <Icon size={14} />
            {meta.label}
          </div>
          <h3 className="mt-2 font-editorial text-[1.48rem] leading-none text-ink">{option.name}</h3>
        </div>
        <div className="rounded-full border border-ink/10 bg-white/65 px-3 py-1 text-xs font-medium text-ink/64">
          {option.estimatedTime}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/70">{option.summary}</p>
      <div className="mt-4 space-y-2">
        {option.steps.slice(0, 3).map((step, index) => (
          <div key={step} className="flex gap-2 text-sm leading-5 text-ink/76">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink/8 text-[0.7rem] font-semibold">
              {index + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSelect(option.id)}
        className="mt-4 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white shadow-[0_12px_24px_rgba(6,63,39,0.18)] transition hover:scale-[0.99]"
      >
        {buttonLabel}
      </button>
    </article>
  );
}
