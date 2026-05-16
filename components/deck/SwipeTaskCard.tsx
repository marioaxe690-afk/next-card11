"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, CheckCircle2, Flame, Info, Snowflake } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";
import { CardTimeUI } from "@/components/deck/CardTimeUI";
import { CompactPlanCatalog } from "@/components/deck/CompactPlanCatalog";

type SwipeTaskCardProps = {
  deck: TaskDeck;
  card: TaskCard;
  focus?: boolean;
};

type DragCue = "complete" | "freeze" | "burn" | "plan" | null;

const COMPLETE_THRESHOLD = -90;
const FREEZE_THRESHOLD = 90;
const BURN_THRESHOLD = -90;
const PLAN_THRESHOLD = 80;

export function SwipeTaskCard({ deck, card, focus = false }: SwipeTaskCardProps) {
  const activeTimeMode = useNextCardStore((state) => state.deck.activeTimeMode);
  const completeCurrentCard = useNextCardStore((state) => state.completeCurrentCard);
  const freezeCurrentDeck = useNextCardStore((state) => state.freezeCurrentDeck);
  const failCurrentDeckByBurn = useNextCardStore((state) => state.failCurrentDeckByBurn);
  const openDeckCardDetail = useNextCardStore((state) => state.openDeckCardDetail);
  const startFocusTiming = useNextCardStore((state) => state.startFocusTiming);
  const [showCatalog, setShowCatalog] = useState(false);
  const [sparks, setSparks] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!actionHint) {
      return;
    }

    const timer = window.setTimeout(() => setActionHint(null), 1800);
    return () => window.clearTimeout(timer);
  }, [actionHint]);

  const elapsedSeconds = useMemo(() => {
    if (!card.startedAt) {
      return card.elapsedSeconds;
    }

    return card.elapsedSeconds + Math.max(0, Math.floor((now - new Date(card.startedAt).getTime()) / 1000));
  }, [card.elapsedSeconds, card.startedAt, now]);

  const playFlint = () => {
    try {
      const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(760, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch {
      // Visual sparks are the graceful fallback when WebAudio is blocked.
    }
  };

  const handleDoubleClick = () => {
    setSparks((value) => value + 1);
    setActionHint("计时开始：只推进这一张卡。");
    playFlint();
    startFocusTiming();
  };

  const handleClick = (detail: number) => {
    if (detail >= 3) {
      setSparks((value) => value + 1);
      setActionHint("任务燃烧失败，已锁定。");
      failCurrentDeckByBurn();
    }
  };

  const currentIndex = deck.cards.findIndex((item) => item.id === card.id);
  const cardPosition = currentIndex >= 0 ? currentIndex + 1 : Math.min(deck.completedCards + 1, deck.totalCards);
  const deckProgress = deck.totalCards === 0 ? 0 : Math.round((deck.completedCards / deck.totalCards) * 100);
  const cardLabel = `第 ${Math.max(1, cardPosition)} / ${deck.totalCards} 张`;
  const dragMeta = getDragMeta(dragOffset.x, dragOffset.y);
  const completionRatio = deck.totalCards === 0 ? 0 : deck.completedCards / deck.totalCards;
  const freezeWeight = 0.48 + (1 - completionRatio) * 0.52;
  const burnIntensity = Math.max(
    dragMeta.burn,
    card.damageEffect === "burn" || activeTimeMode === "burning" ? 0.82 : 0
  );
  const freezeIntensity = Math.max(dragMeta.freeze * freezeWeight, card.damageEffect === "freeze" ? freezeWeight : 0);

  return (
    <div className={focus ? "relative flex h-full min-h-0 flex-col overflow-hidden" : "space-y-3"}>
      <AnimatePresence>
        {showCatalog && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="absolute inset-x-1 bottom-1 z-40 max-h-[78%]"
          >
            <CompactPlanCatalog
              deck={deck}
              currentCardId={card.id}
              onClose={() => setShowCatalog(false)}
              onOpenCard={(cardId) => {
                setShowCatalog(false);
                openDeckCardDetail(cardId);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.article
        key={card.id}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.24}
        onDrag={(_, info) => setDragOffset({ x: info.offset.x, y: info.offset.y })}
        onDragEnd={(_, info) => {
          setDragOffset({ x: 0, y: 0 });

          if (info.offset.x < COMPLETE_THRESHOLD && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
            setActionHint("已完成，进入下一张。");
            completeCurrentCard("left");
            return;
          }

          if (info.offset.x > FREEZE_THRESHOLD && Math.abs(info.offset.x) > Math.abs(info.offset.y)) {
            setActionHint("任务已冻结，后续卡片停止打卡。");
            freezeCurrentDeck();
            return;
          }

          if (info.offset.y < BURN_THRESHOLD && Math.abs(info.offset.y) > Math.abs(info.offset.x) * 0.8) {
            setSparks((value) => value + 1);
            setActionHint("任务燃烧失败，已锁定。");
            failCurrentDeckByBurn();
            return;
          }

          if (info.offset.y > PLAN_THRESHOLD && Math.abs(info.offset.y) > Math.abs(info.offset.x) * 0.75) {
            setShowCatalog(true);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onClick={(event) => handleClick(event.detail)}
        whileTap={{ scale: 0.985 }}
        className={`relative overflow-hidden rounded-[1.8rem] border shadow-card ${
          focus ? "flex min-h-0 flex-1 flex-col p-4" : "p-5"
        } ${
          freezeIntensity > 0
            ? "border-sky-200 bg-[#eefbff] shadow-[0_20px_42px_rgba(79,171,196,0.22)]"
            : burnIntensity > 0
              ? "border-ember/30 bg-[#fff3ea] shadow-[0_20px_46px_rgba(231,120,75,0.24)]"
              : dragMeta.complete > 0
                ? "border-emerald-300 bg-[#f5fff7]"
                : "border-ink/10 bg-[#fff8f1]"
        }`}
      >
        <DragEffectLayer
          complete={dragMeta.complete}
          freeze={freezeIntensity}
          burn={burnIntensity}
          plan={dragMeta.plan}
        />
        <DirectionCue cue={dragMeta.cue} />
        <SparkLayer seed={sparks} active={burnIntensity > 0.45 || sparks > 0} intensity={burnIntensity} />

        <div className="relative z-10 flex h-full min-h-0 flex-col">
          <CardTimeUI card={{ ...card, elapsedSeconds }} cardLabel={cardLabel} deckProgress={deckProgress} />
          <div className="mt-5 flex items-start justify-between gap-3">
            <h3
              className={`min-w-0 overflow-hidden font-editorial leading-tight text-ink ${
                focus ? "max-h-[5rem] text-[2rem]" : "text-[1.85rem]"
              }`}
            >
              {card.title}
            </h3>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openDeckCardDetail(card.id);
              }}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink/10 bg-white/72 px-3 text-xs font-semibold text-ink/70 shadow-sm"
              aria-label="详情"
            >
              <Info size={14} />
              详情
            </button>
          </div>
          <p className={`${focus ? "line-clamp-2" : ""} mt-4 text-[0.98rem] leading-7 text-ink/70`}>
            {card.action}
          </p>
          <div className="mt-auto" />

          <div className="mt-3 min-h-8">
            <AnimatePresence>
              {actionHint && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="rounded-full bg-white/70 px-3 py-2 text-center text-xs font-semibold text-ink/64"
                >
                  {actionHint}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={`${focus ? "mt-4" : "mt-5"} grid grid-cols-[1fr_3rem_3rem_3rem] gap-2`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                completeCurrentCard("button");
              }}
              className="flex h-[52px] items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-semibold text-white"
            >
              <CheckCircle2 size={16} />
              完成
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowCatalog(true);
              }}
              className="grid h-[52px] place-items-center rounded-full border border-ink/10 bg-white/70 text-ink/70"
              aria-label="计划目录"
            >
              <BookOpen size={17} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActionHint("任务燃烧失败，已锁定。");
                failCurrentDeckByBurn();
              }}
              className="grid h-[52px] place-items-center rounded-full border border-ember/20 bg-[#fff0e8] text-ember"
              aria-label="燃烧失败"
            >
              <Flame size={17} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setActionHint("任务已冻结，后续卡片停止打卡。");
                freezeCurrentDeck();
              }}
              className="grid h-[52px] place-items-center rounded-full border border-sky-200 bg-[#eefbff] text-sky-900"
              aria-label="冻结任务"
            >
              <Snowflake size={17} />
            </button>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

function getDragMeta(offsetX: number, offsetY: number) {
  const horizontal = Math.abs(offsetX) > Math.abs(offsetY);
  const vertical = Math.abs(offsetY) > Math.abs(offsetX) * 0.75;
  const complete = horizontal && offsetX < 0 ? clamp(Math.abs(offsetX) / 120) : 0;
  const freeze = horizontal && offsetX > 0 ? clamp(offsetX / 120) : 0;
  const burn = vertical && offsetY < 0 ? clamp(Math.abs(offsetY) / 120) : 0;
  const plan = vertical && offsetY > 0 ? clamp(offsetY / 110) : 0;
  const cue: DragCue =
    complete > 0.28
      ? "complete"
      : freeze > 0.28
        ? "freeze"
        : burn > 0.28
          ? "burn"
          : plan > 0.28
            ? "plan"
            : null;

  return { complete, freeze, burn, plan, cue };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function DragEffectLayer({
  complete,
  freeze,
  burn,
  plan
}: {
  complete: number;
  freeze: number;
  burn: number;
  plan: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.8rem]" aria-hidden="true">
      <CompleteEffectLayer intensity={complete} />
      <PlanEffectLayer intensity={plan} />
      <FreezeEffectLayer intensity={freeze} />
      <BurnEffectLayer intensity={burn} />
    </div>
  );
}

function CompleteEffectLayer({ intensity }: { intensity: number }) {
  return (
    <div
      className="absolute inset-y-0 right-0 w-[72%] bg-[radial-gradient(circle_at_100%_50%,rgba(110,186,135,0.42),transparent_15rem),linear-gradient(270deg,rgba(188,235,199,0.62),rgba(188,235,199,0.2),transparent)]"
      style={{ opacity: intensity }}
    />
  );
}

function PlanEffectLayer({ intensity }: { intensity: number }) {
  return (
    <div
      className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(7,61,40,0.12),rgba(7,61,40,0.035),transparent)]"
      style={{ opacity: intensity }}
    />
  );
}

function FreezeEffectLayer({ intensity }: { intensity: number }) {
  const layerStyle = {
    "--freeze-intensity": intensity,
    "--freeze-crystal-opacity": intensity * 0.9,
    "--freeze-spread": `${18 + intensity * 48}%`
  } as CSSProperties;

  return (
    <div className="frost-effect-layer absolute inset-0" style={layerStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_92%_34%,rgba(236,253,255,0.92),transparent_var(--freeze-spread)),radial-gradient(circle_at_84%_72%,rgba(125,211,252,0.34),transparent_18rem),linear-gradient(110deg,rgba(255,255,255,0.55),rgba(207,245,255,0.18),transparent_64%)]" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />
      <div className="frost-crystal-field absolute inset-0" />
      <div className="absolute inset-y-5 right-0 w-1.5 rounded-l-full bg-white/86 shadow-[0_0_22px_rgba(186,230,253,0.85)]" />
      <div className="absolute right-4 top-5 h-px w-2/3 bg-gradient-to-l from-white/90 via-sky-100/65 to-transparent" />
      {Array.from({ length: 8 }).map((_, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-white shadow-[0_0_10px_rgba(186,230,253,0.72)]"
          style={{
            opacity: intensity * (0.24 + index * 0.05),
            width: `${3 + (index % 3) * 2}px`,
            height: `${3 + (index % 3) * 2}px`,
            right: `${8 + index * 9}%`,
            top: `${14 + (index % 4) * 18}%`
          }}
        />
      ))}
    </div>
  );
}

function BurnEffectLayer({ intensity }: { intensity: number }) {
  const layerStyle = {
    "--burn-intensity": intensity,
    "--burn-glow-opacity": intensity * 0.48,
    "--burn-spark-opacity": Math.min(1, intensity * 1.2),
    "--burn-spread": `${16 + intensity * 52}%`
  } as CSSProperties;

  return (
    <div className="heat-effect-layer absolute inset-0" style={layerStyle}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_105%,rgba(255,186,73,0.78),transparent_var(--burn-spread)),radial-gradient(circle_at_18%_95%,rgba(231,120,75,0.44),transparent_14rem),radial-gradient(circle_at_84%_94%,rgba(198,57,37,0.34),transparent_15rem)]" />
      <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(0deg,rgba(214,80,42,0.56),rgba(250,178,73,0.26),transparent)]" />
      <div className="heat-glow absolute inset-x-8 bottom-7 h-24 rounded-full bg-[#ffbd48] blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-r from-[#c63925] via-[#ffbd48] to-[#e7784b]" />
      <div className="heat-spark-field absolute inset-x-7 bottom-7 h-28">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="ember-particle absolute rounded-full bg-[#ffd46b]"
            style={{
              left: `${8 + index * 10}%`,
              bottom: `${4 + (index % 3) * 8}px`,
              animationDelay: `${index * 90}ms`,
              "--ember-x": `${index % 2 === 0 ? "-" : ""}${10 + index * 2}px`
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

function DirectionCue({ cue }: { cue: DragCue }) {
  const meta = {
    complete: {
      icon: CheckCircle2,
      className: "right-3 top-1/2 -translate-y-1/2 bg-emerald-700 text-white",
      label: "左滑完成"
    },
    freeze: {
      icon: Snowflake,
      className: "left-3 top-1/2 -translate-y-1/2 bg-[#cdebf0] text-sky-950",
      label: "右滑冻结任务"
    },
    burn: {
      icon: Flame,
      className: "inset-x-8 top-3 justify-center bg-[#e7784b] text-white",
      label: "上滑失败锁定"
    },
    plan: {
      icon: BookOpen,
      className: "inset-x-8 bottom-3 justify-center bg-ink text-white",
      label: "下滑目录"
    }
  };

  if (!cue) {
    return null;
  }

  const cueMeta = meta[cue];
  const Icon = cueMeta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className={`pointer-events-none absolute z-20 flex h-10 items-center gap-2 rounded-full px-3 text-xs font-black shadow-card ${cueMeta.className}`}
    >
      <Icon size={16} />
      {cueMeta.label}
    </motion.div>
  );
}

function SparkLayer({ seed, active, intensity }: { seed: number; active: boolean; intensity: number }) {
  if (!active) {
    return null;
  }

  const count = intensity > 0.75 ? 10 : intensity > 0.42 ? 7 : 4;

  return (
    <div key={seed} className="pointer-events-none absolute inset-x-8 top-8 z-10 h-20">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={`${seed}-${index}`}
          className="spark absolute size-1.5 rounded-full bg-gold"
          style={{
            left: `${14 + index * 8}%`,
            top: `${24 + (index % 3) * 12}px`,
            opacity: 0.35 + intensity * 0.65,
            "--spark-x": `${index % 2 === 0 ? "-" : ""}${18 + index * 3}px`
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
