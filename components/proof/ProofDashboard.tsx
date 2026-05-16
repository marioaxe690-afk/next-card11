"use client";

import { CheckCircle2, Flame, Snowflake, Table2 } from "lucide-react";
import type { ProofRecord } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";

const statusTone = {
  completed: "bg-emerald-700 text-white",
  "in-progress": "bg-[#ffe08a] text-ink",
  frozen: "bg-[#cdebf0] text-sky-950",
  failed: "bg-[#e7784b] text-white",
  rewarded: "bg-[#e8b84d] text-ink",
  "needs-review": "bg-[#ffd1bd] text-ink"
} as const;

export function ProofDashboard() {
  const { proofs, deck, openOverlay } = useNextCardStore();
  const records = proofs.records;
  const completed = records.filter((record) => record.status === "completed" || record.status === "rewarded").length;
  const frozen = records.filter((record) => record.status === "frozen" || record.timeStatus === "frozen-rescheduled").length;
  const burning = records.filter((record) => record.timeStatus === "burning-completed" || record.lastDamageEffect === "burn").length;
  const latest = records[0];
  const summary = makeShortSummary(proofs.summaryDocument, completed, deck.completedCardIds.length);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="rounded-[1.7rem] border border-ink/10 bg-white/66 p-5 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fern">今日证据</div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="font-editorial text-[4.6rem] leading-none text-ink">{completed}</div>
          <button
            type="button"
            onClick={() => openOverlay("proof-excel-review")}
            className="mb-1 flex h-10 items-center gap-2 rounded-full bg-ink px-3 text-sm font-semibold text-white"
          >
            <Table2 size={15} />
            完成表
          </button>
        </div>
        <p className="mt-3 line-clamp-2 text-[1rem] leading-7 text-ink/70">{summary}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatusPill
          icon={CheckCircle2}
          label="完成"
          value={completed}
          className="bg-emerald-700 text-white"
          onClick={() => openOverlay("evidence-review")}
        />
        <StatusPill
          icon={Snowflake}
          label="冻结"
          value={frozen}
          className="bg-[#cdebf0] text-sky-950"
          onClick={() => openOverlay("frozen-todo-review")}
        />
        <StatusPill
          icon={Flame}
          label="燃烧"
          value={burning}
          className="bg-[#e7784b] text-white"
          onClick={() => openOverlay("burn-failed-review")}
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[1.7rem] border border-ink/10 bg-white/64 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-editorial text-[1.55rem] leading-tight text-ink">最近一条证据</h2>
          <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/58">{records.length}</span>
        </div>
        <div className="mt-3">
          {latest ? (
            <ProofRow record={latest} onOpen={() => openOverlay("proof-record-review", latest.id)} />
          ) : (
            <div className="rounded-[1.2rem] bg-white/62 px-4 py-10 text-center text-sm text-ink/52">
              完成第一张卡后，这里会出现证据。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusPill({
  icon: Icon,
  label,
  value,
  className,
  onClick
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: number;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 min-w-0 items-center justify-between gap-2 rounded-[1rem] px-3 text-left shadow-sm ${className}`}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
        <Icon size={14} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-editorial text-[1.35rem] leading-none">{value}</span>
    </button>
  );
}

function ProofRow({ record, onOpen }: { record: ProofRecord; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[1.2rem] border border-ink/8 bg-white/76 p-4 text-left shadow-sm transition hover:bg-white/88"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-5 text-ink">{record.goalTitle}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink/64">{record.lastAction}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[record.status]}`}>
          {record.progress}%
        </span>
      </div>
    </button>
  );
}

function makeShortSummary(summary: string, completed: number, completedCards: number) {
  if (completed === 0 && completedCards === 0) {
    return "先完成一张卡，证据会自动出现。";
  }

  const firstSentence = summary.split(/[。.!?]/)[0]?.trim();

  return firstSentence ? `${firstSentence}。` : `今天已经完成 ${completed || completedCards} 个行动证据。`;
}
