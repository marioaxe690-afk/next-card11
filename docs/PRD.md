# Next Card · Product Requirements Document

> 这是 Next Card 的**产品契约文档**(原 `AGENTS.md`),定义了产品规则、实现约束和验收标准。
> AI Coding Agent 在构建或修改本应用时,需严格遵循此文档。
>
> - 想了解项目是什么、怎么跑 → 看 [README](../README.md)
> - 想了解技术架构 → 看 [ARCHITECTURE.md](./ARCHITECTURE.md)
> - 想了解产品规则与验收 → 继续阅读本文档

---

## Project Goal

Build a runnable, demo-ready Web MVP called **Next Card**.

Next Card turns a user's one-sentence goal, written plan, attachment, notification, or image timetable into an AI-planned task card deck. The app analyzes the input in a Codex Plan Mode-like flow, offers three execution plans, converts the selected plan into a simple task flow, then lets the user complete decomposed action cards through a lightweight swipe interaction. Completion, continuation, freezing, burning-time pressure, rescheduling, and reward events are recorded in `proof`.

The product must feel like a modern, calm, card-based action companion. It must not feel like a normal Todo list, a backend dashboard, a marketing landing page, or a word-memorization app.

## Core Loop

```text
Open app
-> choose top mode: input / deck / proof
-> input text, attachment, or image timetable
-> AI analyzes the goal and extracts time information
-> AI generates plan 1 / plan 2 / plan 3
-> user executes one plan or regenerates
-> app generates a task flow overview
-> app generates a deck library entry
-> user opens a deck and swipes task cards
-> each card shows time UI, urgency, and burn/freeze/damage state
-> user completes, continues, freezes, reschedules, or earns reward cards
-> proof records outcomes, reminders, charts, timing events, and summary document
```

## Non-Negotiable Product Rules

- Keep the first screen usable. Do not make a hero/marketing page before the input experience.
- The top navigation must expose exactly three primary modes: `input`, `deck`, `proof`.
- Every generated card must be an already-decomposed action task, not a broad goal.
- Do not display the active deck as a Todo list. The execution surface should focus on one important card at a time.
- Use mock AI, mock OCR, and local state for MVP. Do not connect real OCR, real OpenAI API, real backend, login, or calendar sync in this version.
- Time UI must live on the task card itself, not only on the overview page.
- Burning, sparks, freezing, cracking, and weathering are state feedback. They must not block card readability or shame the user.
- `proof` must turn behavior into visible evidence: colored table, charts, actual time, burn/freeze records, and readable summary.

## Page Modes

### input

`input` is the default mode and leftmost top tab.

Required behavior:

- Provide a ChatGPT-like composer without copying ChatGPT exactly.
- Accept one-sentence goals, long text, assignment notices, timetable text, pasted deadlines, mock attachments, and mock image timetable input.
- Primary action label should be similar to `生成执行方案`.
- After submit, show an analysis state before showing plan options.
- Extract or infer time information: deadline, course start time, estimated duration, available window, suggested start time.
- If input has no explicit time, generate a gentle default time suggestion rather than leaving time empty.

### deck

`deck` stores generated card decks and runs the swipe execution experience.

Required behavior:

- Show historical/generated decks as deck covers before entering the card view.
- A deck cover should feel like a card pack or deck stack. For example, input `去高数课` should create a deck named `去高数课` with a course icon and stacked-card visual.
- Clicking a deck opens a Reigns-like single-card decision surface.
- The active execution view should show one main task card, plus compact progress/time state.
- Every card must show estimated time, time window or countdown, and current urgency stage.

### proof

`proof` records visible evidence of action.

Required behavior:

- Record completed goals, continuing goals, frozen tasks, reward cards, reminders, timing events, and rescheduling events.
- Show a colored table with status, progress, completed cards, frozen cards, actual time, time state, recent action, and next suggestion.
- Show simple charts: progress ring, bar progress, timeline, heat blocks, or compact stat cards.
- Generate a readable summary document explaining what was completed, what remains, and what to do next.

## AI Plan Mode

The AI planning interaction must feel like Codex Plan Mode: understand first, decompose second, offer choices third. Do not immediately generate a pile of tasks.

Inputs may include:

- One-sentence task or goal.
- Course timetable text.
- Mock image timetable extraction.
- Assignment notice.
- Mixed multi-goal text.

AI output must include:

1. Goal understanding.
2. Key constraints: time, deadline, difficulty, energy pressure, dependencies.
3. Initial decomposition into stages.
4. Time strategy: immediate tasks, later push tasks, freeze/reschedule candidates.
5. Three execution plan options.

Plan options:

| Option | Style | Intended Use |
|---|---|---|
| 方案一 | urgent / rapid | Time is tight; produce a minimum viable result first. |
| 方案二 | balanced | Normal progress with balanced speed and detail. |
| 方案三 | gentle | Low-pressure or long-term execution for fatigue or larger goals. |

The option area must provide exactly these main buttons:

- `执行方案一`
- `执行方案二`
- `执行方案三`
- `否，重新生成`

Regeneration keeps the original input and refreshes the analysis and three plan options.

## Task Flow Overview

After a plan is selected, generate a simple task flow before entering card execution.

Flow requirements:

- Use lightweight nodes, links, and progress states.
- Do not create a complex Gantt chart or project-management dashboard.
- Each node represents a stage or group of cards.
- Show total progress and allow entry into the deck.
- Nodes should display time pressure labels such as `还有 25 分钟`, `今晚前`, or `明早课前`.

Status colors:

| Status | Color | Meaning |
|---|---|---|
| not-started | light gray | Not entered yet |
| active | blue or cyan | Currently progressing |
| completed | green | Stage/card group completed |
| frozen | ice blue | User paused and context is saved |
| rewarded | gold or warm color | Reward node after a completed deck |
| attention | orange | Deadline near, window missed, or review needed |

## Deck And Card Interaction

Deck is the core experience. It should combine a clean study-card rhythm, card-pack/deck identity, and Reigns-like swipe decisions. The content must always be action tasks.

### Card Content

Each task card must include:

- Task title.
- One-sentence action instruction.
- Estimated time.
- Deadline or suggested completion window.
- Time UI on card top, edge, border, or bottom rail.
- Parent goal/deck name.
- Flow node advanced by completion.
- Card sequence such as `2 / 8`.
- Optional detail explaining why this step matters now.
- Card back note: short encouragement, context, or reason to continue later.

Good card examples:

- `打开作业要求，圈出必须提交的 3 个点。`
- `用 10 分钟写出最低可提交版本。`
- `把课程表里的明天早八课程加入今日提醒。`
- `整理高数课本和上次作业页，准备出门。`

Bad card examples:

- `学习数学`
- `完成作业`
- `背单词`
- Any broad task that is not decomposed into a next action.

### Swipe And Tap Behavior

Required interactions:

- Right swipe: mark current card as completed.
- Left swipe: also mark current card as completed, as a fast completion action.
- Down swipe: reveal status bar with total task progress and time state.
- Deeper down swipe: trigger freeze visual and ask whether to continue.
- Single click: expand detail or show time explanation.
- Double click: play a flint-like sound or visual feedback, show sparks, and start focused timing.
- Triple click: enter quick burning mode; do not automatically fail the card.

Down-swipe status bar must show:

- Total deck name.
- Completion percentage.
- Completed card count.
- Remaining card count.
- Current flow node status.
- Graphical progress such as ring or horizontal bar.
- Current card time state: `calm`, `warm`, `hot`, `burning`, or `expired`.
- Current elapsed time and remaining time.

Freeze prompt requirements:

- Show ice-blue freezing visuals.
- Frost the card or background.
- Ask: `你还想继续完成这个任务吗？`
- Provide `继续完成` and `先冻结`.
- Continuing keeps the current card and softens pressure copy.
- Freezing records the card as `frozen`, enters the reschedule queue, then moves to the next card or returns to overview.
- If the user chooses not to continue, a crack or ice-crack effect is allowed, but copy must stay gentle.

## Card Time UI And Damage Effects

Every card must include time UI. It expresses time pressure and action rhythm, not punishment.

Time UI must display:

- Estimated duration, such as `10 min`.
- Remaining time or suggested start window, such as `剩 25 min`, `今晚 20:00 前`, or `明早课前`.
- Urgency stage: `calm`, `warm`, `hot`, `burning`, `expired`.
- A visual timer: time rail, progress ring, heated border, flame edge, or burn progress.
- Whether the card has started timing.

Urgency stages:

| Stage | Meaning | Visual |
|---|---|---|
| calm | Time is enough | Quiet, cool edge and subtle countdown |
| warm | User should start soon | Warm hint line or soft time highlight |
| hot | Near deadline | Sparks, light flicker, heated border |
| burning | Final action window | Strong countdown, fire edge, fast burn rail |
| expired | Best window missed | Crack, ash, freeze/reschedule prompt |

Suggested time thresholds for deadline-based cards:

| Window | Stage | Behavior |
|---|---|---|
| more than 20 min | calm | Normal card, light countdown |
| 20-10 min | hot | Slight burn edge, sparks, warm pressure rail |
| 10-3 min | hot to burning | Stronger burn, scorch marks or thin cracks |
| 3-0 min | burning | Quick burn, prominent countdown, crack preview |
| past deadline | expired | Crack/fragment/ash visual and reschedule/review path |

Damage effects:

| Effect | Trigger | Product Meaning |
|---|---|---|
| none | Normal card | No damage |
| burn | Deadline pressure or quick burning mode | The best action window is narrowing |
| freeze | User freezes a card | Context is saved for later |
| crack | Deadline missed or user declines continuation | The card missed its best window |
| weathering | Long-shelved card in deck/proof history | This task has aged and needs review |

Effect priority:

1. `freeze`
2. `burn`
3. `crack`
4. `weathering`
5. `none`

Burning requirements:

- Use warm edge light, sparks, subtle flame, or fast time rail.
- Do not cover or obscure card text.
- Burning is a reminder: `这张卡正在接近最后可行动窗口`.
- Quick burning mode ending without completion should show `继续完成 / 先冻结` or reschedule prompt.
- Burning outcomes must be written to proof, for example `快速燃烧 6 分钟后完成` or `燃烧结束后转入重新安排`.

Audio requirements:

- Double click may use a lightweight WebAudio flint sound.
- If browser autoplay or audio policies block playback, keep visual sparks and do not fail the interaction.

## Reward Cards

When a deck is completed, show a reward card page.

Reward requirements:

- Do not overuse low-value gamification such as generic XP.
- Emphasize that the user turned a goal into visible evidence.
- Show completed nodes, actual time, completed count, next suggestion, and time performance.
- Include time language such as `比预计快 4 分钟完成`, `燃烧模式完成 1 张卡`, or `冻结后重新安排 1 张卡`.
- Reward cards must write to `proof`.

## Proof Module

Proof turns behavior into evidence.

Required proof dashboard items:

- Today's completed goal count.
- Continuing goals.
- Frozen task count.
- Reward card count.
- Today's actual invested time.
- Burning mode completion count.
- Frozen-and-rescheduled count.
- Completion percentage per goal.
- Colored record table.
- Graphical statistics.
- AI summary document.
- Clean blog-style flow journal.

Flow journal requirements:

- Present user actions as chronological narrative entries, not only as table rows.
- Use a clean blog/editorial layout: time on the side, fine timeline, restrained status color, generous whitespace, and readable event copy.
- Each entry must record time, goal, action, urgency state, actual time when available, and next suggestion.
- New events should feel like a flowing log: completed, burning, frozen, rescheduled, rewarded, and needs-review states all appear as journal entries.
- The journal should sit alongside or below the colored proof table, so proof has both structured data and a readable story.

Recommended proof table columns:

```text
目标 | 来源 | 当前状态 | 完成度 | 完成卡片 | 冻结卡片 | 实际用时 | 时间状态 | 最近行动 | 下一步建议
```

Allowed proof statuses:

- `completed`
- `in-progress`
- `frozen`
- `rewarded`
- `needs-review`

Summary document example tone:

```text
今天你完成了 2 个阶段目标，其中 1 个来自课程表任务，1 个来自作业通知。
你有 1 张卡片选择了先冻结，系统已保留上下文，适合明天继续。
你在 1 张卡片上使用了快速燃烧模式，并在 6 分钟内完成了最低可行动作。
最有效的推进方式是先完成 10 分钟内能结束的小任务。
```

## State And Types

Use Zustand, React state, or another simple local state approach. Prefer Zustand plus localStorage for MVP.

Use these type shapes as the implementation baseline. Rename only if the project already has a strongly established convention.

```ts
type SourceType = "text" | "attachment" | "image" | "mixed";
type UrgencyStage = "calm" | "warm" | "hot" | "burning" | "expired";
type DamageEffect = "none" | "burn" | "freeze" | "crack" | "weathering";

type InputsState = {
  text: string;
  attachments: UploadedAttachment[];
  imageSchedule: UploadedImage | null;
  parsedText: string;
  sourceType: SourceType;
};

type PlanOption = {
  id: "plan-1" | "plan-2" | "plan-3";
  name: string;
  style: "urgent" | "balanced" | "gentle";
  summary: string;
  estimatedTime: string;
  detailLevel: "high" | "medium" | "low";
  steps: string[];
};

type PlansState = {
  goalUnderstanding: string;
  constraints: string[];
  timeStrategy: string[];
  options: PlanOption[];
  selectedPlanId: string | null;
  regenerateCount: number;
};

type TaskFlowNode = {
  id: string;
  title: string;
  status: "not-started" | "active" | "completed" | "frozen" | "rewarded" | "attention";
  progress: number;
  timeLabel: string;
  urgencyStage: UrgencyStage;
};

type TaskFlowState = {
  title: string;
  nodes: TaskFlowNode[];
  edges: { from: string; to: string }[];
  overallProgress: number;
};

type TaskDeck = {
  id: string;
  coverTitle: string;
  coverIcon: string;
  deckStatus: "new" | "active" | "frozen" | "completed" | "needs-review";
  cards: TaskCard[];
  totalCards: number;
  completedCards: number;
};

type TaskCard = {
  id: string;
  deckId: string;
  flowNodeId: string;
  title: string;
  action: string;
  estimatedMinutes: number;
  deadlineAt: string | null;
  suggestedStartAt: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  urgencyStage: UrgencyStage;
  damageEffect: DamageEffect;
  damageProgress: number;
  burnLevel: 0 | 1 | 2 | 3;
  status: "queued" | "active" | "completed" | "frozen" | "rewarded" | "needs-review";
  encouragement: string;
  cardBackNote: string;
};

type RewardCard = {
  id: string;
  deckId: string;
  title: string;
  summary: string;
  actualMinutes: number;
  timePerformance: string;
  createdAt: string;
};

type DeckState = {
  decks: TaskDeck[];
  activeDeckId: string | null;
  currentCardId: string | null;
  completedCardIds: string[];
  frozenCardIds: string[];
  rewardCards: RewardCard[];
  rescheduleQueue: string[];
  activeTimeMode: "idle" | "timing" | "burning" | "paused";
};

type ProofRecord = {
  id: string;
  goalTitle: string;
  source: SourceType;
  status: "completed" | "in-progress" | "frozen" | "rewarded" | "needs-review";
  progress: number;
  completedCards: number;
  frozenCards: number;
  actualMinutes: number;
  timeStatus: "on-time" | "burning-completed" | "frozen-rescheduled" | "expired";
  timeDamageEvents: string[];
  lastDamageEffect?: Exclude<DamageEffect, "none">;
  lastAction: string;
  nextSuggestion: string;
  createdAt: string;
};

type ProofsState = {
  records: ProofRecord[];
  summaryDocument: string;
};
```

## Mock AI Requirements

Do not use real AI services in MVP. Mock functions must produce realistic, stable outputs.

Required mock functions:

```ts
mockAnalyzeInput(input)
mockGeneratePlanOptions(analysis)
mockRegeneratePlanOptions(input, previousOptions)
mockGenerateTaskFlow(selectedPlan)
mockGenerateDeckFromPlan(selectedPlan, taskFlow)
mockGenerateTimePlanForCard(card, selectedPlan)
mockUpdateCardUrgency(card, now)
mockRescheduleFrozenCard(card, taskFlow)
mockGenerateProofSummary(proofs)
```

Mock coverage must include:

- One-sentence goal.
- Assignment notice.
- Mock image timetable parsing.
- `去高数课` deck with a course icon, stacked-card cover, and first card in a near-deadline/burning-demo time window.

## Visual Style

Use a modern, lightweight, calm interface with purposeful color.

Visual rules:

- First screen is the usable input composer.
- Top tabs must be clear, clickable, and show active state.
- `input` should feel like an AI composer, not a copied ChatGPT clone.
- `deck` cards should be large, quiet, swipeable, and mobile-friendly.
- Card time UI should feel embedded into the card, not bolted on.
- `calm` should be quiet; `burning` can be visually obvious.
- Sparks, burn, freeze, crack, and weathering must serve the state and must not hide text.
- `proof` table should be colorful but restrained, like an action record rather than Excel.
- Keep dimensions stable so labels, buttons, progress charts, and cards do not jump or overflow.
- Prefer lucide-react icons.
- Avoid a one-note palette. Do not dominate the app with purple, dark blue, brown/orange, or beige themes.

## Technical Constraints

- Build Web MVP first.
- Prefer Next.js App Router + TypeScript + Tailwind CSS.
- Prefer Zustand for app state.
- Use localStorage for decks and proof persistence.
- Use Framer Motion for swipe, freeze, and card transitions.
- Use CSS animation or Framer Motion for sparks, burn, time rail, crack, and weathering.
- Do not introduce heavy particle engines.
- Do not implement real OCR, backend, OpenAI API, auth, calendar sync, or notifications in MVP.
- If audio is blocked, degrade gracefully to visual feedback.

## Recommended Structure

Single-page mode switching is preferred for MVP:

```text
app/page.tsx
app/layout.tsx
```

Route-based mode pages are acceptable if the implementation already prefers routing:

```text
app/input/page.tsx
app/deck/page.tsx
app/proof/page.tsx
```

Recommended components:

```text
components/TopModeTabs.tsx
components/input/InputComposer.tsx
components/input/PlanModePanel.tsx
components/input/PlanOptionCard.tsx
components/flow/TaskFlowOverview.tsx
components/deck/DeckLibrary.tsx
components/deck/SwipeTaskCard.tsx
components/deck/CardTimeUI.tsx
components/deck/BurnTimer.tsx
components/deck/DeckStatusBar.tsx
components/deck/FreezePrompt.tsx
components/deck/RewardCard.tsx
components/proof/ProofDashboard.tsx
components/proof/FlowJournal.tsx
components/proof/JournalEntry.tsx
components/proof/ProofTable.tsx
components/proof/ProofCharts.tsx
components/proof/SummaryDocument.tsx
lib/mock-ai.ts
lib/types.ts
store/useCodeXStore.ts
```

## Implementation Order

Implement in this order:

1. Initialize project and base style.
2. Implement top `input / deck / proof` mode switching.
3. Implement input composer and mock AI analysis.
4. Implement plan option selection and `否，重新生成`.
5. Implement task flow overview.
6. Implement deck library and single active card.
7. Implement card time UI: estimated time, time window, urgency stage, timing, burning state.
8. Implement double-click sparks/timing and triple-click quick burning mode.
9. Implement left/right swipe completion.
10. Implement down-swipe status bar and deeper down-swipe freeze prompt.
11. Implement frozen-card reschedule queue.
12. Implement reward cards with time performance.
13. Implement proof table, charts, actual time, burn/freeze records, and summary document.
14. Add localStorage persistence.
15. Run verification and fix issues.

## Acceptance Criteria

The final demo must support these scenarios:

1. Opening the app shows top `input / deck / proof` tabs.
2. Tabs switch modes inside the app.
3. Entering a one-sentence goal generates AI analysis and three plan options.
4. Clicking `否，重新生成` refreshes the three plans while keeping the input.
5. Clicking any execution plan generates a task flow overview.
6. The overview shows task nodes, progress, and time pressure labels.
7. Entering deck shows a deck cover and then one decomposed task card.
8. `去高数课` generates a named deck cover with course icon/stacked-card visual.
9. A task card shows estimated time, remaining time or suggested window, and urgency stage.
10. Double-clicking a card shows sparks and starts timing.
11. Triple-clicking a card enters quick burning mode.
12. Left or right swipe completes the current card and updates progress and actual time.
13. Down swipe shows status bar with progress, current time state, elapsed time, and remaining time.
14. Deeper down swipe shows freeze prompt with `继续完成` and `先冻结`.
15. Choosing `先冻结` records the card as frozen and adds it to the reschedule queue.
16. Completing a deck shows a reward card with time performance.
17. `proof` shows colored table, graphical stats, actual time, burn/freeze records, and AI summary.
18. `proof` includes a clean blog-style flow journal with chronological action entries.
19. Refreshing preserves historical decks, timing state where practical, and proof records.

Run these checks before claiming completion:

```bash
pnpm lint
pnpm build
```

If tests exist, also run:

```bash
pnpm test
```

Final implementation summary must include:

- Change summary.
- How to run.
- Verification results.
- Remaining mocked capabilities.
- Extension points for real OCR, OpenAI API, backend, reminders, or calendar sync.
