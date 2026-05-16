"use client";

import { CheckCircle2, Flame, Snowflake, Table2, type LucideIcon } from "lucide-react";
import type { ProofRecord, TaskDeck } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";

type ProjectStatus = "completed" | "active" | "frozen" | "failed" | "queued";

type ProofProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  proofCount: number;
  updatedAt: string;
  summary: string;
  progress: number;
  completedCards: number;
  totalCards: number;
};

const statusTone: Record<ProjectStatus, { label: string; dot: string; chip: string; muted: string }> = {
  completed: {
    label: "完成",
    dot: "bg-moss",
    chip: "bg-moss/10 text-moss ring-moss/15",
    muted: "text-moss/62"
  },
  active: {
    label: "进行中",
    dot: "bg-ink",
    chip: "bg-ink/[0.06] text-ink ring-ink/10",
    muted: "text-ink/48"
  },
  frozen: {
    label: "冻结",
    dot: "bg-sky-300",
    chip: "bg-sky-50 text-sky-900 ring-sky-200/70",
    muted: "text-sky-900/52"
  },
  failed: {
    label: "失败",
    dot: "bg-ember",
    chip: "bg-[#fff1e8] text-ember ring-ember/18",
    muted: "text-ember/58"
  },
  queued: {
    label: "待开始",
    dot: "bg-ink/24",
    chip: "bg-ink/[0.045] text-ink/56 ring-ink/8",
    muted: "text-ink/38"
  }
};

export function ProofDashboard() {
  const { proofs, deck, openOverlay } = useNextCardStore();
  const projects = buildProofProjects(deck.decks, proofs.records);
  const visibleProjects = projects.slice(0, 6);
  const completed = projects.filter((project) => project.status === "completed").length;
  const frozen = projects.filter((project) => project.status === "frozen").length;
  const failed = projects.filter((project) => project.status === "failed").length;
  const active = projects.filter((project) => project.status === "active" || project.status === "queued").length;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="rounded-[1.45rem] border border-ink/10 bg-white/72 p-4 shadow-[0_16px_38px_rgba(31,41,35,0.08)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-fern">Proof backend</div>
            <h1 className="mt-1 font-editorial text-[1.72rem] leading-tight text-ink">任务后台</h1>
          </div>
          <button
            type="button"
            onClick={() => openOverlay("proof-excel-review")}
            className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white shadow-[0_12px_24px_rgba(6,63,39,0.16)]"
          >
            <Table2 size={14} />
            记录
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[6.4rem_minmax(0,1fr)] items-center gap-4">
          <StatusDonut completed={completed} frozen={frozen} failed={failed} active={active} total={projects.length} />
          <div className="grid gap-2">
            <MetricLine icon={CheckCircle2} label="完成" value={completed} className="text-moss" />
            <MetricLine icon={Snowflake} label="冻结" value={frozen} className="text-sky-900" />
            <MetricLine icon={Flame} label="失败" value={failed} className="text-ember" />
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[1.45rem] border border-ink/10 bg-white/58 p-3 shadow-[0_16px_38px_rgba(31,41,35,0.07)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold leading-5 text-ink">任务组记录</h2>
            <p className="mt-0.5 text-[0.68rem] font-medium text-ink/42">按任务个体收纳，不展开单张卡</p>
          </div>
          <span className="rounded-full bg-ink/[0.055] px-2.5 py-1 text-[0.68rem] font-semibold text-ink/52">
            {projects.length} 个任务
          </span>
        </div>

        <div className="mt-3 min-h-0 overflow-y-auto pr-0.5">
          {visibleProjects.length > 0 ? (
            <div className="grid gap-1.5">
              {visibleProjects.map((project) => (
                <ProjectRecordRow key={project.id} project={project} />
              ))}
              {projects.length > visibleProjects.length && (
                <div className="rounded-[0.9rem] border border-dashed border-ink/10 bg-white/38 px-3 py-3 text-center text-xs font-semibold text-ink/42">
                  另有 {projects.length - visibleProjects.length} 个历史任务已收起
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[1rem] bg-white/66 px-4 py-10 text-center text-sm text-ink/52">
              生成一个 deck 后，这里会按任务聚合展示 proof。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusDonut({
  completed,
  frozen,
  failed,
  active,
  total
}: {
  completed: number;
  frozen: number;
  failed: number;
  active: number;
  total: number;
}) {
  const safeTotal = Math.max(total, 1);
  const completedEnd = (completed / safeTotal) * 100;
  const frozenEnd = completedEnd + (frozen / safeTotal) * 100;
  const failedEnd = frozenEnd + (failed / safeTotal) * 100;
  const background = `conic-gradient(#0f5335 0 ${completedEnd}%, #7dd3fc ${completedEnd}% ${frozenEnd}%, #e7784b ${frozenEnd}% ${failedEnd}%, rgba(6,63,39,0.1) ${failedEnd}% 100%)`;

  return (
    <div className="relative grid size-[6.4rem] place-items-center rounded-full border border-ink/8 bg-white/64 shadow-sm">
      <div className="absolute inset-2 rounded-full" style={{ background }} />
      <div className="relative grid size-[4.35rem] place-items-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(6,63,39,0.08)]">
        <div>
          <div className="font-editorial text-[1.5rem] leading-none text-ink">{total}</div>
          <div className="mt-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-ink/36">tasks</div>
        </div>
      </div>
      <span className="sr-only">活跃或待开始任务 {active} 个</span>
    </div>
  );
}

function MetricLine({
  icon: Icon,
  label,
  value,
  className
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex h-8 items-center justify-between rounded-full border border-ink/8 bg-white/56 px-2.5">
      <span className={`flex items-center gap-1.5 text-xs font-semibold ${className}`}>
        <Icon size={13} />
        {label}
      </span>
      <span className="text-xs font-semibold text-ink/56">{value}</span>
    </div>
  );
}

function ProjectRecordRow({ project }: { project: ProofProjectRecord }) {
  const tone = statusTone[project.status];

  return (
    <article className="rounded-[0.95rem] border border-ink/8 bg-white/62 px-3 py-3">
      <div className="grid grid-cols-[0.9rem_minmax(0,1fr)_3.4rem] items-start gap-2">
        <span className={`mt-1.5 size-2 rounded-full ${tone.dot}`} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-sm font-semibold leading-5 text-ink">{project.title}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ring-1 ${tone.chip}`}>
              {tone.label}
            </span>
          </div>
          <p className="mt-1 truncate text-[0.72rem] leading-5 text-ink/48">{project.summary}</p>
        </div>
        <div className="justify-self-end text-right">
          <div className="text-sm font-semibold leading-5 text-ink">{project.progress}%</div>
          <div className="text-[0.6rem] font-semibold text-ink/34">{project.totalCards} 张</div>
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[0.64rem] font-semibold text-ink/38">
        <span className="truncate">
          {project.completedCards}/{project.totalCards} 完成 · {project.proofCount} proof
        </span>
        <span className="shrink-0">{formatDate(project.updatedAt)}</span>
      </div>
    </article>
  );
}

function buildProofProjects(decks: TaskDeck[], records: ProofRecord[]): ProofProjectRecord[] {
  const deckIds = new Set(decks.map((item) => item.id));
  const deckProjects = decks.map((item) => makeDeckProject(item, records.filter((record) => record.deckId === item.id)));
  const orphanGroups = groupByTitle(records.filter((record) => !record.deckId || !deckIds.has(record.deckId)));
  const orphanProjects = Array.from(orphanGroups.entries()).map(([title, group], index) => makeOrphanProject(title, group, index));

  return [...deckProjects, ...orphanProjects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function makeDeckProject(deck: TaskDeck, records: ProofRecord[]): ProofProjectRecord {
  const sorted = sortRecords(records);
  const completedCards = deck.cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const progress = deck.totalCards === 0 ? 0 : Math.round((completedCards / deck.totalCards) * 100);

  return {
    id: deck.id,
    title: deck.coverTitle,
    status: getProjectStatus(deck, records),
    proofCount: records.length,
    updatedAt: sorted[0]?.createdAt ?? new Date(0).toISOString(),
    summary: makeProjectSummary(deck, sorted[0], records.length),
    progress,
    completedCards,
    totalCards: deck.totalCards
  };
}

function makeOrphanProject(title: string, records: ProofRecord[], index: number): ProofProjectRecord {
  const sorted = sortRecords(records);
  const latest = sorted[0];
  const completedCards = Math.max(...records.map((record) => record.completedCards), 0);
  const progress = Math.max(...records.map((record) => record.progress), 0);

  return {
    id: `orphan-${index}-${title}`,
    title,
    status: latest?.status === "failed" ? "failed" : latest?.status === "frozen" ? "frozen" : progress >= 100 ? "completed" : "active",
    proofCount: records.length,
    updatedAt: latest?.createdAt ?? new Date(0).toISOString(),
    summary: makeProjectSummary(undefined, latest, records.length),
    progress,
    completedCards,
    totalCards: Math.max(completedCards, 1)
  };
}

function getProjectStatus(deck: TaskDeck, records: ProofRecord[]): ProjectStatus {
  if (deck.deckStatus === "failed" || records.some((record) => record.status === "failed")) {
    return "failed";
  }

  if (deck.deckStatus === "frozen" || records.some((record) => record.status === "frozen")) {
    return "frozen";
  }

  if (deck.deckStatus === "completed") {
    return "completed";
  }

  return records.length > 0 ? "active" : "queued";
}

function makeProjectSummary(deck: TaskDeck | undefined, latest: ProofRecord | undefined, proofCount: number) {
  if (deck?.deckStatus === "failed") {
    return `燃烧失败 · 包含 ${deck.totalCards} 张卡`;
  }

  if (deck?.deckStatus === "frozen") {
    return `后台冻结 · 包含 ${deck.totalCards} 张卡`;
  }

  if (!latest) {
    return "还没有 proof，进入 deck 后开始记录。";
  }

  const action = latest.lastAction.replace(/^完成：/, "").replace(/^冻结任务：/, "").replace(/^任务失败：/, "").replace(/^奖励卡生成：/, "");
  return `${action} · ${proofCount} 条 proof`;
}

function groupByTitle(records: ProofRecord[]) {
  return records.reduce((map, record) => {
    const group = map.get(record.goalTitle) ?? [];
    group.push(record);
    map.set(record.goalTitle, group);
    return map;
  }, new Map<string, ProofRecord[]>());
}

function sortRecords(records: ProofRecord[]) {
  return [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return "未更新";
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}
