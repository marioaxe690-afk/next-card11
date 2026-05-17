import type { TaskCard, TaskDeck, UrgencyStage, DamageEffect } from "@/lib/types";

const PROTECTED_STATUSES: TaskCard["status"][] = [
  "completed",
  "frozen",
  "rewarded",
  "needs-review",
];

function isProtectedFromTimeRefresh(card: TaskCard) {
  return PROTECTED_STATUSES.includes(card.status);
}

export type CardTimeRefreshOptions = {
  preserveBurnFromUserAction?: boolean;
};

export function refreshCardTimeState(
  card: TaskCard,
  now: Date = new Date(),
  options: CardTimeRefreshOptions = {},
): TaskCard {
  if (isProtectedFromTimeRefresh(card)) {
    return card;
  }

  if (!card.deadlineAt) {
    return card;
  }

  const deadlineMs = new Date(card.deadlineAt).getTime();
  const seconds = Math.floor((deadlineMs - now.getTime()) / 1000);

  if (seconds <= 0) {
    return {
      ...card,
      urgencyStage: "expired" as UrgencyStage,
      damageEffect: "crack" as DamageEffect,
      remainingSeconds: 0,
      damageProgress: 100,
      burnLevel: 0,
    };
  }

  if (seconds <= 180) {
    return {
      ...card,
      urgencyStage: "burning" as UrgencyStage,
      damageEffect: "burn" as DamageEffect,
      burnLevel: 3,
      remainingSeconds: seconds,
      damageProgress: Math.max(card.damageProgress, 86),
    };
  }

  if (seconds <= 1200) {
    if (options.preserveBurnFromUserAction && card.damageEffect === "burn") {
      return { ...card, urgencyStage: "hot" as UrgencyStage, remainingSeconds: seconds };
    }
    return {
      ...card,
      urgencyStage: "hot" as UrgencyStage,
      damageEffect: "burn" as DamageEffect,
      burnLevel: Math.max(card.burnLevel, 2) as 0 | 1 | 2 | 3,
      remainingSeconds: seconds,
      damageProgress: Math.max(card.damageProgress, 52),
    };
  }

  return { ...card, urgencyStage: "calm" as UrgencyStage, remainingSeconds: seconds };
}

export function refreshDeckTimeState(
  deck: TaskDeck,
  now: Date = new Date(),
  options: CardTimeRefreshOptions = {},
): TaskDeck {
  const cards = deck.cards.map((card) => refreshCardTimeState(card, now, options));
  return { ...deck, cards };
}
