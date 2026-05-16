"use client";

import { AlertTriangle, CheckCircle2, Flame, Layers3, Snowflake } from "lucide-react";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { SwipeTaskCard } from "@/components/deck/SwipeTaskCard";
import { useNextCardStore } from "@/store/useNextCardStore";

export function DeckLibrary() {
  const { deck, resetInputDraft, setMode } = useNextCardStore();
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId) ?? deck.decks[0];
  const activeCard = getActiveCard(activeDeck, deck.currentCardId);

  if (deck.decks.length === 0) {
    return (
      <section className="phone-shell grain flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center shadow-soft">
        <Layers3 className="relative z-10 text-ink/42" size={34} />
        <h2 className="relative z-10 mt-4 font-editorial text-[1.85rem] text-ink">还没有 deck</h2>
        <p className="relative z-10 mx-auto mt-2 max-w-[18rem] text-sm leading-6 text-ink/60">
          先到 input 生成一张行动卡。
        </p>
      </section>
    );
  }

  return (
    <section className="phone-shell grain relative flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <div className="relative z-10 h-full min-h-0">
        {activeDeck && isLockedDeck(activeDeck) ? (
          <LockedDeckState
            deck={activeDeck}
            onProof={() => setMode("proof")}
            onNewGoal={() => {
              resetInputDraft();
              setMode("input");
            }}
          />
        ) : activeDeck && activeCard ? (
          <SwipeTaskCard deck={activeDeck} card={activeCard} focus />
        ) : (
          <div className="grid h-full min-h-0 place-items-center rounded-[1.5rem] border border-ink/10 bg-white/56 px-5 text-center text-sm leading-6 text-ink/58">
            这一组已经完成，证据已进入 proof。
          </div>
        )}
      </div>
    </section>
  );
}

function getActiveCard(deck: TaskDeck | undefined, currentCardId: string | null): TaskCard | undefined {
  if (!deck) {
    return undefined;
  }

  if (isLockedDeck(deck)) {
    return undefined;
  }

  return (
    deck.cards.find((card) => card.id === currentCardId) ??
    deck.cards.find((card) => card.status === "active") ??
    deck.cards.find((card) => card.status === "queued")
  );
}

function isLockedDeck(deck: TaskDeck) {
  return deck.deckStatus === "frozen" || deck.deckStatus === "failed" || deck.deckStatus === "completed";
}

function LockedDeckState({
  deck,
  onProof,
  onNewGoal
}: {
  deck: TaskDeck;
  onProof: () => void;
  onNewGoal: () => void;
}) {
  const completed = deck.cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const progress = deck.totalCards === 0 ? 0 : Math.round((completed / deck.totalCards) * 100);
  const freezeDepth = deck.deckStatus === "frozen" ? Math.max(0.18, 1 - progress / 100) : 0;
  const tone = getLockedTone(deck.deckStatus);
  const Icon = tone.Icon;

  return (
    <article className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.55rem] border p-5 shadow-card ${tone.panel}`}>
      <div className="pointer-events-none absolute -right-14 -top-14 size-44 rounded-full bg-white/28 blur-sm" aria-hidden />
      {deck.deckStatus === "frozen" && (
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_16%,rgba(224,247,255,0.96),transparent_13rem),radial-gradient(circle_at_84%_80%,rgba(125,211,252,0.36),transparent_17rem),linear-gradient(120deg,rgba(255,255,255,0.52),rgba(207,245,255,0.22),transparent_68%)] backdrop-blur-[1.5px]"
          style={{ opacity: freezeDepth }}
          aria-hidden
        />
      )}
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={`text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${tone.muted}`}>Task locked</div>
          <h2 className="mt-2 font-editorial text-[2rem] leading-tight text-ink">{deck.coverTitle}</h2>
        </div>
        <div className={`grid size-12 shrink-0 place-items-center rounded-[1rem] ${tone.iconBox}`}>
          <Icon size={22} />
        </div>
      </div>

      <div className="relative z-10 mt-6 rounded-[1.2rem] border border-white/50 bg-white/58 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{tone.title}</span>
          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-xs font-semibold text-ink/54">
            {completed}/{deck.totalCards} 张
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/60">{tone.description}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8">
          <div className={`h-full rounded-full ${tone.progress}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="relative z-10 mt-auto grid gap-2">
        <button
          type="button"
          onClick={onProof}
          className="flex h-12 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white"
        >
          查看任务记录
        </button>
        <button
          type="button"
          onClick={onNewGoal}
          className="flex h-12 items-center justify-center rounded-full border border-ink/10 bg-white/68 text-sm font-semibold text-ink"
        >
          新建目标
        </button>
      </div>
    </article>
  );
}

function getLockedTone(status: TaskDeck["deckStatus"]) {
  if (status === "frozen") {
    return {
      title: "任务已冻结在后台",
      description: "后续卡片已停止打卡。Proof 会保留这组任务，稍后可重新规划。",
      panel: "border-sky-200/70 bg-[linear-gradient(145deg,#f7fdff,#e7f8ff_48%,#fff8f1)]",
      iconBox: "bg-white/72 text-sky-900 shadow-[0_0_26px_rgba(125,211,252,0.28)]",
      muted: "text-sky-900/50",
      progress: "bg-sky-300",
      Icon: Snowflake
    };
  }

  if (status === "failed") {
    return {
      title: "任务已燃烧失败",
      description: "这组任务已经锁定，不能继续或重新开始。需要重做时请新建目标。",
      panel: "border-ember/24 bg-[linear-gradient(145deg,#fff8f1,#fff1e8_48%,#f8e2d7)]",
      iconBox: "bg-white/72 text-ember shadow-[0_0_28px_rgba(231,120,75,0.26)]",
      muted: "text-ember/60",
      progress: "burn-rail",
      Icon: Flame
    };
  }

  if (status === "completed") {
    return {
      title: "任务已完成",
      description: "整组任务已经形成 proof，后续记录会以任务个体保存在后台。",
      panel: "border-moss/16 bg-[linear-gradient(145deg,#fff8f1,#edf5ef_55%,#ffffff)]",
      iconBox: "bg-moss text-white",
      muted: "text-fern",
      progress: "bg-moss",
      Icon: CheckCircle2
    };
  }

  return {
    title: "任务不可继续",
    description: "这组任务当前不能继续打卡，请回到 Proof 查看任务记录。",
    panel: "border-ink/10 bg-white/64",
    iconBox: "bg-ink/[0.06] text-ink",
    muted: "text-ink/46",
    progress: "bg-ink/40",
    Icon: AlertTriangle
  };
}
