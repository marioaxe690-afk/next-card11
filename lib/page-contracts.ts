import type {
  AnalysisResult,
  ActiveOverlay,
  DeckState,
  InputsState,
  Mode,
  OverlayType,
  PlanOption,
  PlansState,
  ProofsState,
  TaskDeck,
  TaskFlowState
} from "@/lib/types";

export type ContractStatus = "implemented" | "partial" | "todo";

export type IntegrationArea =
  | "mock-ai"
  | "ocr"
  | "openai"
  | "backend"
  | "reminders"
  | "calendar"
  | "audio"
  | "motion"
  | "testing";

export type PageActionContract = {
  name: string;
  status: ContractStatus;
  ownerFile: string;
  purpose: string;
  inputShape: string;
  outputShape: string;
  nextWork: string;
};

export type PageContract = {
  mode: Mode;
  status: ContractStatus;
  ownerFiles: string[];
  reads: string[];
  writes: string[];
  actions: PageActionContract[];
  extensionAreas: IntegrationArea[];
};

export type InputPagePort = {
  mode: "input";
  state: InputsState;
  analysis: AnalysisResult | null;
  plans: PlansState;
  taskFlow: TaskFlowState | null;
  submitInput: () => void;
  submitGoalAndCreateDeck: () => void;
  regeneratePlans: () => void;
  selectPlan: (planId: PlanOption["id"]) => void;
  openPlanCatalog: () => void;
  openOverlay: (type: OverlayType, id?: string) => void;
};

export type DeckPagePort = {
  mode: "deck";
  state: DeckState;
  activeDeck: TaskDeck | null;
  deckPanelOpen: boolean;
  focusCardMode: boolean;
  activePlanCatalogId?: string;
  openDeck: (deckId: string) => void;
  openDeckPanel: () => void;
  closeDeckPanel: () => void;
  toggleFocusCardMode: () => void;
  openPlanCatalog: () => void;
  openDeckCardDetail: (cardId: string) => void;
  openDeckCard: (deckId: string, cardId: string) => void;
  completeCurrentCard: (direction: "left" | "right" | "button") => void;
  revealStatusBar: () => void;
  requestFreezeCurrentCard: () => void;
  startFocusTiming: () => void;
  startQuickBurning: () => void;
};

export type ProofPagePort = {
  mode: "proof";
  state: ProofsState;
  activeOverlay: ActiveOverlay;
  refreshSummary: () => void;
  exportSummaryDocument: () => void;
  openOverlay: (type: OverlayType, id?: string) => void;
};

export const PAGE_CONTRACTS: Record<Mode, PageContract> = {
  input: {
    mode: "input",
    status: "implemented",
    ownerFiles: [
      "app/page.tsx",
      "components/input/InputComposer.tsx",
      "components/input/PlanModePanel.tsx",
      "components/input/PlanOptionCard.tsx",
      "components/flow/TaskFlowOverview.tsx",
      "lib/mock-ai.ts",
      "store/useNextCardStore.ts"
    ],
    reads: ["inputs", "analysis", "analysisStatus", "plans", "taskFlow"],
    writes: ["inputs", "analysis", "plans", "taskFlow", "deck.decks", "proofs.records"],
    actions: [
      {
        name: "submitInput",
        status: "implemented",
        ownerFile: "components/input/InputComposer.tsx",
        purpose: "Collect text, mock attachment, or mock image timetable, then directly create a compact task decomposition and deck.",
        inputShape: "InputsState",
        outputShape: "AnalysisResult + TaskFlowState + TaskDeck + ProofRecord",
        nextWork: "Keep compact plan switching for plan-1 / plan-2 / plan-3 while replacing mock analysis later."
      },
      {
        name: "regeneratePlans",
        status: "implemented",
        ownerFile: "store/useNextCardStore.ts",
        purpose: "Keep original input and refresh the three plan options.",
        inputShape: "InputsState + previous PlanOption[]",
        outputShape: "PlanOption[]",
        nextWork: "Add regeneration reason chips if users need control over speed/detail/pressure."
      },
      {
        name: "selectPlan",
        status: "implemented",
        ownerFile: "store/useNextCardStore.ts",
        purpose: "Generate task flow, create deck entry, and write the first proof record.",
        inputShape: "PlanOption['id']",
        outputShape: "TaskFlowState + TaskDeck + ProofRecord",
        nextWork: "Keep this wired to the compact segmented control in InputComposer."
      }
    ],
    extensionAreas: ["mock-ai", "ocr", "openai", "testing"]
  },
  deck: {
    mode: "deck",
    status: "partial",
    ownerFiles: [
      "components/deck/DeckLibrary.tsx",
      "components/deck/CardTimeUI.tsx",
      "store/useNextCardStore.ts",
      "lib/mock-ai.ts"
    ],
    reads: ["deck.decks", "deck.activeDeckId", "deck.currentCardId", "focusCardMode", "activePlanCatalogId"],
    writes: ["deck.completedCardIds", "deck.frozenCardIds", "deck.rescheduleQueue", "deck.rewardCards", "proofs.records"],
    actions: [
      {
        name: "openDeck",
        status: "implemented",
        ownerFile: "store/useNextCardStore.ts",
        purpose: "Open a generated deck, close the side stack, and show its current active card.",
        inputShape: "deckId: string",
        outputShape: "activeDeckId + currentCardId + focusCardMode",
        nextWork: "Add resume ordering for frozen cards if users need manual queue control."
      },
      {
        name: "renderFocusedDeck",
        status: "implemented",
        ownerFile: "components/deck/DeckLibrary.tsx",
        purpose: "Render one full-height active card, keep the unfinished stack on the side in focus mode, and move it below the card in non-focus mode.",
        inputShape: "DeckState + focusCardMode",
        outputShape: "single-card focus UI + fullscreen unfinished stack overlay",
        nextWork: "Tune the non-focus stack tray height after testing with real device safe areas."
      },
      {
        name: "completeCurrentCard",
        status: "implemented",
        ownerFile: "store/useNextCardStore.ts",
        purpose: "Left or right swipe marks the card completed, advances the deck, updates time, and records proof.",
        inputShape: "direction: 'left' | 'right'",
        outputShape: "updated TaskDeck + ProofRecord",
        nextWork: "Tune drag thresholds after touch testing on a real Android WebView."
      },
      {
        name: "revealStatusBar",
        status: "implemented",
        ownerFile: "components/deck/DeckStatusBar.tsx",
        purpose: "Down swipe reveals deck progress, elapsed time, remaining time, and current urgency stage.",
        inputShape: "current TaskDeck + current TaskCard",
        outputShape: "visible status bar UI",
        nextWork: "Add node display names instead of raw flow node ids."
      },
      {
        name: "requestFreezeCurrentCard",
        status: "implemented",
        ownerFile: "components/deck/FreezePrompt.tsx",
        purpose: "Deeper down swipe shows freeze prompt and lets user continue or freeze.",
        inputShape: "current TaskCard",
        outputShape: "frozen card + rescheduleQueue entry + ProofRecord",
        nextWork: "Add resume-from-reschedule queue screen."
      },
      {
        name: "startFocusTiming",
        status: "implemented",
        ownerFile: "components/deck/SwipeTaskCard.tsx",
        purpose: "Double click starts timing, shows sparks, and attempts the lightweight flint sound.",
        inputShape: "current TaskCard",
        outputShape: "startedAt + activeTimeMode: 'timing'",
        nextWork: "Tune the WebAudio sound in native Android WebView."
      },
      {
        name: "startQuickBurning",
        status: "implemented",
        ownerFile: "components/deck/SwipeTaskCard.tsx",
        purpose: "Triple click enters quick burning mode without failing the card.",
        inputShape: "current TaskCard",
        outputShape: "activeTimeMode: 'burning' + burn proof event",
        nextWork: "Extract BurnTimer from SwipeTaskCard if the countdown becomes richer."
      }
    ],
    extensionAreas: ["motion", "audio", "reminders", "testing"]
  },
  proof: {
    mode: "proof",
    status: "partial",
    ownerFiles: [
      "components/proof/ProofDashboard.tsx",
      "store/useNextCardStore.ts",
      "lib/mock-ai.ts"
    ],
    reads: ["proofs.records", "proofs.summaryDocument", "deck.rewardCards"],
    writes: ["proofs.summaryDocument"],
    actions: [
      {
        name: "renderProofDashboard",
        status: "implemented",
        ownerFile: "components/proof/ProofDashboard.tsx",
        purpose: "Show a no-page-scroll mobile proof summary with key stats, latest evidence, detailed burn/freeze reviews, and a full-row color completion table.",
        inputShape: "ProofsState",
        outputShape: "compact mobile dashboard UI + fullscreen review overlays + color-covered completion rows",
        nextWork: "Add real export only if the product needs .xlsx download after the mobile table is validated."
      },
      {
        name: "refreshSummary",
        status: "implemented",
        ownerFile: "lib/mock-ai.ts",
        purpose: "Generate readable summary text from proof records.",
        inputShape: "ProofRecord[]",
        outputShape: "summaryDocument: string",
        nextWork: "Later replace with real summary service or local deterministic richer formatter."
      },
      {
        name: "exportSummaryDocument",
        status: "todo",
        ownerFile: "components/proof/SummaryDocument.tsx",
        purpose: "Export or copy a readable proof summary document.",
        inputShape: "ProofsState",
        outputShape: "downloadable markdown or copyable document text",
        nextWork: "Decide whether MVP needs markdown export, print view, or copy button."
      }
    ],
    extensionAreas: ["backend", "openai", "testing"]
  }
};

export const NEXT_IMPLEMENTATION_BACKLOG = [
  "Build SwipeTaskCard and replace static active card preview.",
  "Tune swipe, burn, and freeze thresholds on real Android devices.",
  "Split proof dashboard into table, charts, flow journal, and summary document components when needed.",
  "Add deterministic Playwright smoke tests for input, deck, and proof flows.",
  "Keep OCR, OpenAI, backend, reminders, and calendar sync mocked until the MVP interaction loop is stable."
] as const;
