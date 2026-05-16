"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  mockAnalyzeInput,
  mockGenerateDeckFromPlan,
  mockGeneratePlanOptions,
  mockGenerateProofSummary,
  mockGenerateTaskFlow,
  mockRegeneratePlanOptions
} from "@/lib/mock-ai";
import type {
  ActiveOverlay,
  AnalysisResult,
  DeckState,
  InputsState,
  LastCompletion,
  Mode,
  PlanOption,
  PlansState,
  ProofRecord,
  ProofsState,
  RewardCard,
  TaskCard,
  TaskDeck,
  TaskFlowState,
  OverlayType,
  UploadedAttachment,
  UploadedImage
} from "@/lib/types";

type AnalysisStatus = "idle" | "analyzing" | "ready";

type NextCardStore = {
  mode: Mode;
  inputs: InputsState;
  analysis: AnalysisResult | null;
  analysisStatus: AnalysisStatus;
  plans: PlansState;
  taskFlow: TaskFlowState | null;
  deck: DeckState;
  proofs: ProofsState;
  activeOverlay: ActiveOverlay;
  lastCompletion?: LastCompletion;
  deckPanelOpen: boolean;
  focusCardMode: boolean;
  activePlanCatalogId?: string;
  setMode: (mode: Mode) => void;
  openOverlay: (type: OverlayType, id?: string) => void;
  closeOverlay: () => void;
  openPlanCatalog: () => void;
  openDeckCardDetail: (cardId: string) => void;
  openDeckCard: (deckId: string, cardId: string) => void;
  openDeckPanel: () => void;
  closeDeckPanel: () => void;
  toggleFocusCardMode: () => void;
  setInputText: (text: string) => void;
  addMockAttachment: () => void;
  addMockImageSchedule: () => void;
  addImageUpload: (file: File) => void;
  addDocumentUpload: (file: File) => void;
  removeInputAttachment: (id: string) => void;
  removeImageUpload: (id?: string) => void;
  analyzeInput: () => void;
  finishAnalysis: () => void;
  submitGoalAndCreateDeck: () => void;
  resetInputDraft: () => void;
  regeneratePlans: () => void;
  selectPlan: (planId: PlanOption["id"]) => void;
  openDeck: (deckId: string) => void;
  completeCurrentCard: (direction: "left" | "right" | "button") => void;
  freezeCurrentDeck: () => void;
  failCurrentDeckByBurn: () => void;
  freezeCurrentCard: () => void;
  continueCurrentCard: () => void;
  startFocusTiming: () => void;
  startQuickBurning: () => void;
};

type PersistedNextCardState = Partial<
  Pick<
    NextCardStore,
    "inputs" | "analysis" | "analysisStatus" | "plans" | "taskFlow" | "deck" | "proofs"
  >
>;

const defaultInputs: InputsState = {
  text: "",
  attachments: [],
  imageSchedule: null,
  parsedText: "",
  sourceType: "text"
};

const defaultPlans: PlansState = {
  goalUnderstanding: "",
  constraints: [],
  timeStrategy: [],
  options: [],
  selectedPlanId: null,
  regenerateCount: 0
};

const defaultDeck: DeckState = {
  decks: [],
  activeDeckId: null,
  currentCardId: null,
  completedCardIds: [],
  frozenCardIds: [],
  rewardCards: [],
  rescheduleQueue: [],
  activeTimeMode: "idle"
};

const mockAttachment = (): UploadedAttachment => ({
  id: `attachment-${Date.now()}`,
  name: "assignment-notice.txt",
  kind: "notice",
  mockedText: "课程作业通知：今晚 20:00 前提交一页简短分析，需包含观点、例子和结论。"
});

const mockImage = (): UploadedImage => ({
  id: `image-${Date.now()}`,
  name: "mock-timetable.png",
  parsedTimetable: "图像课表识别：明天 08:00 高数课，地点二教 304，建议提前 20 分钟出门。"
});

function makeDocumentAttachment(file: File): UploadedAttachment {
  return {
    id: `document-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    name: file.name || "未命名文档",
    kind: "document",
    mockedText: `已添加文档：${file.name || "未命名文档"}。稍后可接入真实解析，现在先按文档目标生成行动卡。`,
    size: file.size,
    mimeType: file.type || undefined
  };
}

function makeImageUpload(file: File): UploadedImage {
  return {
    id: `image-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    name: file.name || "已添加图片",
    parsedTimetable: `已添加图片：${file.name || "图片"}。稍后可接入图库 OCR，现在先按图片内容生成行动卡。`,
    size: file.size,
    mimeType: file.type || undefined
  };
}

function getParsedText(inputs: Pick<InputsState, "attachments" | "imageSchedule">) {
  return [
    ...inputs.attachments.map((attachment) => attachment.mockedText),
    inputs.imageSchedule?.parsedTimetable
  ].filter(Boolean).join("\n");
}

function getSourceType(inputs: Pick<InputsState, "text" | "attachments" | "imageSchedule">): InputsState["sourceType"] {
  const hasText = Boolean(inputs.text.trim());
  const hasAttachment = inputs.attachments.length > 0;
  const hasImage = Boolean(inputs.imageSchedule);
  const sourceCount = [hasText, hasAttachment, hasImage].filter(Boolean).length;

  if (sourceCount > 1) {
    return "mixed";
  }

  if (hasImage) {
    return "image";
  }

  if (hasAttachment) {
    return "attachment";
  }

  return "text";
}

const makeProofId = () => `proof-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const makeRewardId = () => `reward-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

function getActualMinutes(card: TaskCard) {
  const startedSeconds = card.startedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(card.startedAt).getTime()) / 1000))
    : 0;
  const seconds = Math.max(card.elapsedSeconds, startedSeconds, Math.round(card.estimatedMinutes * 42));

  return Math.max(1, Math.ceil(seconds / 60));
}

function getDeckActualMinutes(cards: TaskCard[]) {
  return Math.max(
    1,
    cards.reduce((sum, card) => {
      if (card.status === "completed" || card.status === "rewarded" || card.startedAt) {
        return sum + getActualMinutes(card);
      }

      return sum;
    }, 0)
  );
}

function getNextCardId(cards: TaskCard[], currentIndex: number) {
  return cards.slice(currentIndex + 1).find((card) => card.status === "queued")?.id ?? null;
}

function updateFlowFromCards(taskFlow: TaskFlowState | null, cards: TaskCard[]): TaskFlowState | null {
  if (!taskFlow) {
    return null;
  }

  const completed = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const overallProgress = cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100);

  return {
    ...taskFlow,
    overallProgress,
    nodes: taskFlow.nodes.map((node) => {
      const nodeCards = cards.filter((card) => card.flowNodeId === node.id);
      const nodeDone = nodeCards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
      const nodeFrozen = nodeCards.some((card) => card.status === "frozen");
      const nodeFailed = nodeCards.some((card) => card.status === "needs-review" && card.damageEffect === "burn");
      const nodeActive = nodeCards.some((card) => card.status === "active");

      if (nodeCards.length === 0) {
        return node;
      }

      return {
        ...node,
        status: nodeFailed ? "failed" : nodeFrozen ? "frozen" : nodeDone === nodeCards.length ? "completed" : nodeActive ? "active" : "not-started",
        progress: Math.round((nodeDone / nodeCards.length) * 100),
        urgencyStage: nodeFailed ? "expired" : nodeActive ? nodeCards.find((card) => card.status === "active")?.urgencyStage ?? node.urgencyStage : node.urgencyStage
      };
    })
  };
}

function lockFlowFromCards(
  taskFlow: TaskFlowState | null,
  cards: TaskCard[],
  lockStatus: "frozen" | "failed"
): TaskFlowState | null {
  if (!taskFlow) {
    return null;
  }

  const completed = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const overallProgress = cards.length === 0 ? 0 : Math.round((completed / cards.length) * 100);

  return {
    ...taskFlow,
    overallProgress,
    nodes: taskFlow.nodes.map((node) => {
      const nodeCards = cards.filter((card) => card.flowNodeId === node.id);

      if (nodeCards.length === 0) {
        return node;
      }

      const nodeDone = nodeCards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
      const locked = nodeDone === nodeCards.length ? "completed" : lockStatus;

      return {
        ...node,
        status: locked,
        progress: Math.round((nodeDone / nodeCards.length) * 100),
        urgencyStage: lockStatus === "failed" && locked !== "completed" ? "expired" : "calm"
      };
    })
  };
}

function replaceDeck(decks: TaskDeck[], updatedDeck: TaskDeck) {
  return decks.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck));
}

function getDeckProofProgress(deck: TaskDeck, frozenCards = 0) {
  return {
    progress: deck.totalCards === 0 ? 0 : Math.round((deck.completedCards / deck.totalCards) * 100),
    completedCards: deck.completedCards,
    frozenCards
  };
}

function makeInitialProofRecord(
  generatedDeck: TaskDeck,
  selected: PlanOption,
  source: InputsState["sourceType"]
): ProofRecord {
  return {
    id: makeProofId(),
    deckId: generatedDeck.id,
    cardId: generatedDeck.cards[0]?.id,
    goalTitle: generatedDeck.coverTitle,
    source,
    status: "in-progress",
    progress: 0,
    completedCards: 0,
    frozenCards: 0,
    actualMinutes: 0,
    timeStatus: generatedDeck.cards[0]?.urgencyStage === "burning" ? "burning-completed" : "on-time",
    timeDamageEvents:
      generatedDeck.cards[0]?.damageEffect === "burn"
        ? ["生成第一张近截止燃烧演示卡"]
        : ["生成执行卡组"],
    lastDamageEffect: generatedDeck.cards[0]?.damageEffect === "burn" ? "burn" : undefined,
    lastAction: `选择${selected.name}并生成任务流`,
    nextSuggestion: "进入 deck，先完成第一张最小行动卡",
    createdAt: new Date().toISOString()
  };
}

export const useNextCardStore = create<NextCardStore>()(
  persist(
    (set, get) => ({
      mode: "input",
      inputs: defaultInputs,
      analysis: null,
      analysisStatus: "idle",
      plans: defaultPlans,
      taskFlow: null,
      deck: defaultDeck,
      proofs: {
        records: [],
        summaryDocument: mockGenerateProofSummary([])
      },
      activeOverlay: null,
      lastCompletion: undefined,
      deckPanelOpen: false,
      focusCardMode: true,
      activePlanCatalogId: undefined,
      setMode: (mode) => set((state) => ({ mode, deckPanelOpen: mode === "deck" ? state.deckPanelOpen : false })),
      openOverlay: (type, id) => set({ activeOverlay: { type, id } }),
      closeOverlay: () => set({ activeOverlay: null }),
      openPlanCatalog: () =>
        set((state) => {
          const deckId = state.deck.activeDeckId ?? state.deck.decks[0]?.id;

          return {
            activePlanCatalogId: deckId,
            activeOverlay: { type: "plan-catalog-detail", id: deckId }
          };
        }),
      openDeckCardDetail: (cardId) => set({ activeOverlay: { type: "deck-card-detail", id: cardId } }),
      openDeckCard: (deckId, cardId) =>
        set((state) => {
          const targetDeck = state.deck.decks.find((deck) => deck.id === deckId);
          const locked = targetDeck?.deckStatus === "frozen" || targetDeck?.deckStatus === "failed" || targetDeck?.deckStatus === "completed";

          return {
            mode: "deck",
            activeOverlay: null,
            deckPanelOpen: false,
            focusCardMode: true,
            deck: {
              ...state.deck,
              activeDeckId: deckId,
              currentCardId: locked ? null : cardId
            }
          };
        }),
      openDeckPanel: () => set({ deckPanelOpen: true }),
      closeDeckPanel: () => set({ deckPanelOpen: false }),
      toggleFocusCardMode: () => set((state) => ({ focusCardMode: !state.focusCardMode })),
      setInputText: (text) =>
        set((state) => ({
          inputs: {
            ...state.inputs,
            text,
            sourceType: getSourceType({ ...state.inputs, text })
          }
        })),
      addMockAttachment: () =>
        set((state) => {
          const attachment = mockAttachment();
          return {
            inputs: {
              ...state.inputs,
              attachments: [...state.inputs.attachments, attachment],
              parsedText: getParsedText({
                attachments: [...state.inputs.attachments, attachment],
                imageSchedule: state.inputs.imageSchedule
              }),
              sourceType: getSourceType({
                ...state.inputs,
                attachments: [...state.inputs.attachments, attachment]
              })
            }
          };
        }),
      addMockImageSchedule: () =>
        set((state) => {
          const imageSchedule = mockImage();
          return {
            inputs: {
              ...state.inputs,
              imageSchedule,
              parsedText: getParsedText({ attachments: state.inputs.attachments, imageSchedule }),
              sourceType: getSourceType({ ...state.inputs, imageSchedule })
            }
          };
        }),
      addImageUpload: (file) =>
        set((state) => {
          const imageSchedule = makeImageUpload(file);

          return {
            inputs: {
              ...state.inputs,
              imageSchedule,
              parsedText: getParsedText({ attachments: state.inputs.attachments, imageSchedule }),
              sourceType: getSourceType({ ...state.inputs, imageSchedule })
            }
          };
        }),
      addDocumentUpload: (file) =>
        set((state) => {
          const attachment = makeDocumentAttachment(file);
          const attachments = [...state.inputs.attachments, attachment];

          return {
            inputs: {
              ...state.inputs,
              attachments,
              parsedText: getParsedText({ attachments, imageSchedule: state.inputs.imageSchedule }),
              sourceType: getSourceType({ ...state.inputs, attachments })
            }
          };
        }),
      removeInputAttachment: (id) =>
        set((state) => {
          const attachments = state.inputs.attachments.filter((attachment) => attachment.id !== id);

          return {
            inputs: {
              ...state.inputs,
              attachments,
              parsedText: getParsedText({ attachments, imageSchedule: state.inputs.imageSchedule }),
              sourceType: getSourceType({ ...state.inputs, attachments })
            }
          };
        }),
      removeImageUpload: (id) =>
        set((state) => {
          if (id && state.inputs.imageSchedule?.id !== id) {
            return state;
          }

          return {
            inputs: {
              ...state.inputs,
              imageSchedule: null,
              parsedText: getParsedText({ attachments: state.inputs.attachments, imageSchedule: null }),
              sourceType: getSourceType({ ...state.inputs, imageSchedule: null })
            }
          };
        }),
      analyzeInput: () => {
        const state = get();
        const analysis = mockAnalyzeInput(state.inputs);

        set({
          analysis,
          analysisStatus: "analyzing",
          plans: {
            ...defaultPlans,
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy
          },
          taskFlow: null
        });
      },
      finishAnalysis: () => {
        const state = get();
        const analysis = state.analysis ?? mockAnalyzeInput(state.inputs);
        const options = mockGeneratePlanOptions(analysis);

        set({
          analysis,
          analysisStatus: "ready",
          plans: {
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy,
            options,
            selectedPlanId: null,
            regenerateCount: state.plans.regenerateCount
          }
        });
      },
      submitGoalAndCreateDeck: () => {
        const state = get();

        if (!state.inputs.text.trim() && state.inputs.attachments.length === 0 && !state.inputs.imageSchedule) {
          return;
        }

        const analysis = mockAnalyzeInput(state.inputs);
        const options = mockGeneratePlanOptions(analysis);
        const selected = options[0];
        const taskFlow = mockGenerateTaskFlow(selected);
        const goalTitle = state.inputs.text.trim() || (state.inputs.imageSchedule ? "去高数课" : "今日推进");
        const generatedDeck = mockGenerateDeckFromPlan(selected, taskFlow, goalTitle);
        const proofRecord = makeInitialProofRecord(generatedDeck, selected, state.inputs.sourceType);
        const records = [proofRecord, ...state.proofs.records];

        set({
          analysis,
          analysisStatus: "ready",
          plans: {
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy,
            options,
            selectedPlanId: selected.id,
            regenerateCount: state.plans.regenerateCount
          },
          taskFlow,
          deck: {
            ...state.deck,
            decks: [generatedDeck, ...state.deck.decks.filter((deck) => deck.coverTitle !== generatedDeck.coverTitle)],
            activeDeckId: generatedDeck.id,
            currentCardId: generatedDeck.cards[0]?.id ?? null
          },
          proofs: {
            records,
            summaryDocument: mockGenerateProofSummary(records)
          }
        });
      },
      resetInputDraft: () =>
        set({
          inputs: defaultInputs,
          analysis: null,
          analysisStatus: "idle",
          plans: defaultPlans,
          taskFlow: null
        }),
      regeneratePlans: () => {
        const state = get();
        const analysis = mockAnalyzeInput(state.inputs);
        const options = mockRegeneratePlanOptions(state.inputs, state.plans.options);

        set({
          analysis,
          analysisStatus: "ready",
          plans: {
            goalUnderstanding: analysis.goalUnderstanding,
            constraints: analysis.constraints,
            timeStrategy: analysis.timeStrategy,
            options,
            selectedPlanId: null,
            regenerateCount: state.plans.regenerateCount + 1
          },
          taskFlow: null
        });
      },
      selectPlan: (planId) => {
        const state = get();
        const selected = state.plans.options.find((option) => option.id === planId);

        if (!selected) {
          return;
        }

        const taskFlow = mockGenerateTaskFlow(selected);
        const goalTitle = state.inputs.text.trim() || (state.inputs.imageSchedule ? "去高数课" : "今日推进");
        const generatedDeck = mockGenerateDeckFromPlan(selected, taskFlow, goalTitle);
        const proofRecord = makeInitialProofRecord(generatedDeck, selected, state.inputs.sourceType);
        const records = [proofRecord, ...state.proofs.records];

        set({
          taskFlow,
          plans: {
            ...state.plans,
            selectedPlanId: planId
          },
          deck: {
            ...state.deck,
            decks: [generatedDeck, ...state.deck.decks.filter((deck) => deck.coverTitle !== generatedDeck.coverTitle)],
            activeDeckId: generatedDeck.id,
            currentCardId: generatedDeck.cards[0]?.id ?? null
          },
          proofs: {
            records,
            summaryDocument: mockGenerateProofSummary(records)
          }
        });
      },
      openDeck: (deckId) =>
        set((state) => {
          const deck = state.deck.decks.find((item) => item.id === deckId);
          const locked = deck?.deckStatus === "frozen" || deck?.deckStatus === "failed" || deck?.deckStatus === "completed";

          return {
            mode: "deck",
            deckPanelOpen: false,
            focusCardMode: true,
            deck: {
              ...state.deck,
              activeDeckId: deckId,
              currentCardId: locked
                ? null
                : deck?.cards.find((card) => card.status === "active")?.id ?? deck?.cards.find((card) => card.status === "queued")?.id ?? null
            }
          };
        }),
      startFocusTiming: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

          if (!activeDeck || !currentCard || activeDeck.deckStatus === "frozen" || activeDeck.deckStatus === "failed" || activeDeck.deckStatus === "completed") {
            return state;
          }

          const cards = activeDeck.cards.map((card) =>
            card.id === currentCard.id
              ? {
                  ...card,
                  startedAt: card.startedAt ?? new Date().toISOString(),
                  status: "active" as const
                }
              : card
          );
          const updatedDeck = { ...activeDeck, deckStatus: "active" as const, cards };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            deckId: activeDeck.id,
            cardId: currentCard.id,
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "in-progress",
            ...getDeckProofProgress(updatedDeck, state.deck.frozenCardIds.length),
            actualMinutes: 0,
            timeStatus: "on-time",
            timeDamageEvents: ["双击卡片，开始专注计时"],
            lastAction: `开始计时：${currentCard.title}`,
            nextSuggestion: "完成这张卡，或下滑查看状态后选择冻结",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              activeTimeMode: "timing"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      failCurrentDeckByBurn: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

          if (!activeDeck || activeDeck.deckStatus === "frozen" || activeDeck.deckStatus === "failed" || activeDeck.deckStatus === "completed") {
            return state;
          }

          const cards = activeDeck.cards.map((card) =>
            card.status === "completed" || card.status === "rewarded"
              ? card
              : {
                  ...card,
                  startedAt: card.id === currentCard?.id ? card.startedAt ?? new Date().toISOString() : card.startedAt,
                  status: "needs-review" as const,
                  urgencyStage: "expired" as const,
                  damageEffect: "burn" as const,
                  damageProgress: 100,
                  burnLevel: 3 as const,
                  remainingSeconds: 0,
                  cardBackNote: "这组任务已经因燃烧失败锁定，不能继续打卡。"
                }
          );
          const completedCount = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
          const updatedDeck: TaskDeck = {
            ...activeDeck,
            deckStatus: "failed",
            cards,
            completedCards: completedCount
          };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            deckId: activeDeck.id,
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "failed",
            ...getDeckProofProgress(updatedDeck, cards.filter((card) => card.status === "frozen").length),
            actualMinutes: getDeckActualMinutes(activeDeck.cards),
            timeStatus: "expired",
            timeDamageEvents: ["上滑触发燃烧失败，整组任务停止后续打卡"],
            lastDamageEffect: "burn",
            lastAction: `任务失败：${activeDeck.coverTitle}`,
            nextSuggestion: "该任务已锁定。需要重做时，请从 Input 新建一个新任务。",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            taskFlow: lockFlowFromCards(state.taskFlow, cards, "failed"),
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              currentCardId: null,
              activeTimeMode: "idle"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      startQuickBurning: () => get().failCurrentDeckByBurn(),
      continueCurrentCard: () =>
        set((state) => ({
          deck: {
            ...state.deck,
            activeTimeMode: state.deck.activeTimeMode === "paused" ? "idle" : state.deck.activeTimeMode
          }
        })),
      freezeCurrentDeck: () =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentCard = activeDeck?.cards.find((card) => card.id === state.deck.currentCardId);

          if (!activeDeck || activeDeck.deckStatus === "frozen" || activeDeck.deckStatus === "failed" || activeDeck.deckStatus === "completed") {
            return state;
          }

          const cards = activeDeck.cards.map((card) =>
            card.status === "completed" || card.status === "rewarded"
              ? card
              : {
                  ...card,
                  status: "frozen" as const,
                  damageEffect: "freeze" as const,
                  urgencyStage: "calm" as const,
                  burnLevel: 0 as const,
                  suggestedStartAt: card.suggestedStartAt ?? new Date().toISOString(),
                  cardBackNote: "整组任务已冻结在后台，后续卡片停止打卡。"
                }
          );
          const frozenIds = cards.filter((card) => card.status === "frozen").map((card) => card.id);
          const frozenCardIds = Array.from(new Set([...state.deck.frozenCardIds, ...frozenIds]));
          const updatedDeck: TaskDeck = {
            ...activeDeck,
            deckStatus: "frozen",
            cards,
            completedCards: cards.filter((card) => card.status === "completed" || card.status === "rewarded").length
          };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            deckId: activeDeck.id,
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: "frozen",
            ...getDeckProofProgress(updatedDeck, frozenIds.length),
            actualMinutes: currentCard ? getActualMinutes(currentCard) : getDeckActualMinutes(activeDeck.cards),
            timeStatus: "frozen-rescheduled",
            timeDamageEvents: ["右滑冻结整组任务，停止后续卡片打卡"],
            lastDamageEffect: "freeze",
            lastAction: `冻结任务：${activeDeck.coverTitle}`,
            nextSuggestion: "任务已冻结在后台。需要恢复时，从任务记录重新规划，不继续当前卡组。",
            createdAt: new Date().toISOString()
          };
          const records = [proofRecord, ...state.proofs.records];

          return {
            taskFlow: lockFlowFromCards(state.taskFlow, cards, "frozen"),
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              currentCardId: null,
              frozenCardIds,
              rescheduleQueue: Array.from(new Set([...state.deck.rescheduleQueue, activeDeck.id])),
              activeTimeMode: "idle"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        }),
      freezeCurrentCard: () => get().freezeCurrentDeck(),
      completeCurrentCard: (direction) =>
        set((state) => {
          const activeDeck = state.deck.decks.find((deck) => deck.id === state.deck.activeDeckId);
          const currentIndex = activeDeck?.cards.findIndex((card) => card.id === state.deck.currentCardId) ?? -1;
          const currentCard = activeDeck?.cards[currentIndex];

          if (!activeDeck || !currentCard || activeDeck.deckStatus === "frozen" || activeDeck.deckStatus === "failed" || activeDeck.deckStatus === "completed") {
            return state;
          }

          const actualMinutes = getActualMinutes(currentCard);
          const nextCardId = getNextCardId(activeDeck.cards, currentIndex);
          const completedCardIds = Array.from(new Set([...state.deck.completedCardIds, currentCard.id]));
          const wasBurning = state.deck.activeTimeMode === "burning" || currentCard.urgencyStage === "burning";
          const cards = activeDeck.cards.map((card) => {
            if (card.id === currentCard.id) {
              return {
                ...card,
                status: "completed" as const,
                elapsedSeconds: actualMinutes * 60,
                damageProgress: wasBurning ? 100 : card.damageProgress,
                urgencyStage: wasBurning ? "burning" as const : card.urgencyStage
              };
            }

            if (card.id === nextCardId) {
              return { ...card, status: "active" as const };
            }

            return card;
          });
          const completedCount = cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
          const allDone = completedCount === activeDeck.totalCards;
          const rewardCard: RewardCard | null = allDone
            ? {
                id: makeRewardId(),
                deckId: activeDeck.id,
                title: `${activeDeck.coverTitle} 已变成行动证据`,
                summary: `完成 ${completedCount} 张分解卡，实际投入约 ${cards.reduce((sum, card) => sum + Math.ceil(card.elapsedSeconds / 60), 0)} 分钟。`,
                actualMinutes: cards.reduce((sum, card) => sum + Math.ceil(card.elapsedSeconds / 60), 0),
                timePerformance: wasBurning ? "燃烧模式完成 1 张卡" : `比预计更稳地完成 ${completedCount} 张卡`,
                createdAt: new Date().toISOString()
              }
            : null;
          const updatedDeck: TaskDeck = {
            ...activeDeck,
            deckStatus: allDone ? "completed" : "active",
            cards,
            completedCards: completedCount
          };
          const proofRecord: ProofRecord = {
            id: makeProofId(),
            deckId: activeDeck.id,
            cardId: currentCard.id,
            goalTitle: activeDeck.coverTitle,
            source: state.inputs.sourceType,
            status: allDone ? "rewarded" : "completed",
            ...getDeckProofProgress(updatedDeck, state.deck.frozenCardIds.length),
            actualMinutes,
            timeStatus: wasBurning ? "burning-completed" : "on-time",
            timeDamageEvents: [
              `${direction === "left" ? "左滑" : direction === "right" ? "右滑" : "按钮"}完成卡片`,
              wasBurning ? `快速燃烧 ${actualMinutes} 分钟后完成` : `实际用时 ${actualMinutes} 分钟`
            ],
            lastDamageEffect: wasBurning ? "burn" : undefined,
            lastAction: allDone ? `奖励卡生成：${currentCard.title}` : `完成：${currentCard.title}`,
            nextSuggestion: allDone ? "查看 proof summary，并决定下一组 deck" : "进入下一张卡，保持单卡节奏",
            createdAt: new Date().toISOString()
          };
          const rewardProof: ProofRecord | null = rewardCard
            ? {
                id: makeProofId(),
                deckId: activeDeck.id,
                cardId: currentCard.id,
                goalTitle: activeDeck.coverTitle,
                source: state.inputs.sourceType,
                status: "rewarded",
                progress: 100,
                completedCards: completedCount,
                frozenCards: state.deck.frozenCardIds.length,
                actualMinutes: rewardCard.actualMinutes,
                timeStatus: wasBurning ? "burning-completed" : "on-time",
                timeDamageEvents: ["奖励卡生成", rewardCard.timePerformance],
                lastAction: rewardCard.title,
                nextSuggestion: "把结果写入 proof，稍后复盘最有效的小任务",
                createdAt: rewardCard.createdAt
              }
            : null;
          const records = [rewardProof, proofRecord, ...state.proofs.records].filter(Boolean) as ProofRecord[];

          return {
            taskFlow: updateFlowFromCards(state.taskFlow, cards),
            lastCompletion: {
              deckId: activeDeck.id,
              cardId: currentCard.id,
              proofId: proofRecord.id
            },
            activeOverlay: allDone ? { type: "completion-receipt" } : state.activeOverlay,
            deck: {
              ...state.deck,
              decks: replaceDeck(state.deck.decks, updatedDeck),
              currentCardId: allDone ? null : nextCardId,
              completedCardIds,
              rewardCards: rewardCard ? [rewardCard, ...state.deck.rewardCards] : state.deck.rewardCards,
              activeTimeMode: "idle"
            },
            proofs: {
              records,
              summaryDocument: mockGenerateProofSummary(records)
            }
          };
        })
    }),
    {
      name: "next-card-mvp",
      version: 2,
      migrate: (persistedState) => persistedState as PersistedNextCardState,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as PersistedNextCardState;

        return {
          ...currentState,
          inputs: persisted.inputs ?? currentState.inputs,
          analysis: persisted.analysis ?? currentState.analysis,
          analysisStatus: persisted.analysisStatus ?? currentState.analysisStatus,
          plans: persisted.plans ?? currentState.plans,
          taskFlow: persisted.taskFlow ?? currentState.taskFlow,
          deck: persisted.deck ?? currentState.deck,
          proofs: persisted.proofs ?? currentState.proofs,
          mode: "input",
          activeOverlay: null,
          deckPanelOpen: false,
          focusCardMode: true,
          activePlanCatalogId: undefined,
          lastCompletion: undefined
        };
      },
      partialize: (state) => ({
        inputs: state.inputs,
        analysis: state.analysis,
        analysisStatus: state.analysisStatus,
        plans: state.plans,
        taskFlow: state.taskFlow,
        deck: state.deck,
        proofs: state.proofs
      })
    }
  )
);
