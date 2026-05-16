"use client";

import { ArrowRight, CheckCircle2, Circle, Flame, Snowflake, TimerReset } from "lucide-react";
import { useNextCardStore } from "@/store/useNextCardStore";

const statusClass = {
  "not-started": "border-ink/10 bg-white/62 text-ink/55",
  active: "border-cyan-500/24 bg-cyan-50 text-cyan-900",
  completed: "border-emerald-500/24 bg-emerald-50 text-emerald-900",
  frozen: "border-sky-300 bg-sky-50 text-sky-900",
  failed: "border-ember/26 bg-[#fff1e8] text-ember",
  rewarded: "border-gold/40 bg-[#fff6d9] text-[#6d4b04]",
  attention: "border-ember/30 bg-[#fff1e9] text-[#7b341a]"
};

const statusIcon = {
  "not-started": Circle,
  active: TimerReset,
  completed: CheckCircle2,
  frozen: Snowflake,
  failed: Flame,
  rewarded: CheckCircle2,
  attention: TimerReset
};

export function TaskFlowOverview() {
  const { taskFlow, deck, openDeck } = useNextCardStore();

  if (!taskFlow) {
    return null;
  }

  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId);

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white/56 p-4 shadow-soft backdrop-blur">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">task flow overview</div>
          <h2 className="mt-2 font-editorial text-[1.75rem] leading-tight text-ink">{taskFlow.title}</h2>
          <p className="mt-2 max-w-[34rem] text-sm leading-6 text-ink/62">
            这是进入 deck 前的轻量路线图。每个节点代表一组行动卡，不是项目管理甘特图。
          </p>
        </div>
        {activeDeck && (
          <button
            type="button"
            onClick={() => {
              openDeck(activeDeck.id);
              window.requestAnimationFrame(() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
              });
            }}
            className="h-11 w-full rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(6,63,39,0.18)] transition hover:scale-[0.99]"
          >
            进入 deck
          </button>
        )}
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink/8">
        <div className="h-full rounded-full bg-moss" style={{ width: `${taskFlow.overallProgress}%` }} />
      </div>

      <div className="mt-5 grid gap-3">
        {taskFlow.nodes.map((node, index) => {
          const Icon = statusIcon[node.status];

          return (
            <article key={node.id} className={`rounded-[1.35rem] border p-4 ${statusClass[node.status]}`}>
              <div className="flex items-center justify-between gap-2">
                <Icon size={18} />
                <span className="rounded-full bg-white/58 px-2.5 py-1 text-[0.7rem] font-semibold">
                  {node.timeLabel}
                </span>
              </div>
              <h3 className="mt-4 min-h-12 text-sm font-semibold leading-5">{node.title}</h3>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold">
                <span>{node.status}</span>
                {index < taskFlow.nodes.length - 1 && <ArrowRight size={14} />}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
