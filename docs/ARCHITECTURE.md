# Next Card · Architecture

> 这是给开发者和技术决策者的**系统设计文档**。
> 想了解产品规则,看 [PRD.md](./PRD.md);想跑起来,看 [README](../README.md)。

---

## 1. 概览

Next Card 是一个把"模糊目标"转化为"可滑动卡组 + 可见证据"的 AI 应用。它在工程上的核心挑战不是"调用一次 LLM 拿到结果",而是:

- **AI 怎么少问、问对、按时收束** —— 不让用户被反问轰炸
- **后台调度怎么不偷偷动用户的时间** —— 任何写入都需经过门禁
- **多供应商/无 API key 都能跑** —— Demo 友好,降级优雅
- **客户端单屏 WebView,服务端有真正的调度** —— 两套形态,一份代码

整个系统按"**前台对话 Agent + 后台调度 Agent**"两层切分,中间用类型化的 `QueueAction` 协议传递。

```
┌──────────────────────────────────────────────────────────────┐
│  Browser / WebView (单屏 ~430px)                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │   input    │→ │    deck    │→ │   proof    │              │
│  │  (composer)│  │  (swipe)   │  │ (evidence) │              │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │
│        │ Zustand store + localStorage (schema v4)            │
└────────┼──────────────┼─────────────────┼───────────────────┘
         │              │                 │
         ▼              ▼                 ▼
   POST /api/chat   POST /api/agent/   POST /api/backend/
   /api/ai/clarify  schedule           worker/tick
         │              │                 │
         ▼              ▼                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Server (Next.js Route Handlers, Node runtime)               │
│                                                              │
│  Agent 1 — Clarify & Plan          Agent 2 — Schedule & Push│
│  ┌────────────────────┐           ┌────────────────────┐    │
│  │ plan-mode-service  │           │ priority-engine    │    │
│  │ compat-ai-service  │           │ schedule-planner   │    │
│  │ ai-prompts (禁区)  │           │ freeze-return-agent│    │
│  └─────────┬──────────┘           │ provider-dispatch  │    │
│            │                      │ agent-runtime guard│    │
│            ▼                      └─────────┬──────────┘    │
│  Provider Cascade                           │               │
│  DeepSeek → Mimo → Local Mock               ▼               │
│                              Web Push ┘ ┌─ ICS Calendar     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 双 Agent 边界

> 关键工程判断:**不是一个万能 Agent,而是两个职责独立的 Agent**。
> 边界清晰之后,Mimo 可以专注理解、调度层可以独立测试、Provider 可以替换。

### Agent 1 — 澄清与规划

**职责**:把人话翻译成结构化目标 + 三套方案,**不写队列**。

**核心文件**:

| 文件 | 职责 |
|---|---|
| `app/api/chat/route.ts` | 流式风格的结构化对话入口 |
| `app/api/ai/clarify/route.ts` | 单轮澄清 |
| `lib/server/plan-mode-service.ts` | Plan Mode 四阶段状态机 |
| `lib/server/compat-ai-service.ts` | 三方供应商适配层 |
| `lib/ai-prompts.ts` | System prompt + 反 AI 腔禁区 |
| `lib/mock-ai.ts` | 无 API key 时的本地兜底 |

**四阶段状态机**(单一事实源在 `lib/ai-prompts.ts`,前后端共享):

```
thinking ──▶ asking ──▶ generating ──▶ ready
   │           │                          │
   │           └─ "按默认理解直接生成方案" ──┘
   │
   └─ 用户输入清晰时直接跳过 ──▶ asking
```

**硬性收束**:`CLARIFICATION_TURN_BUDGET = 5`,前后端共享一个常量,达到后强制 `ready`,**不允许无限反问**。

### Agent 2 — 调度与推送

**职责**:在卡片冻结/到点/优先级变化时产生 `QueueAction[]`,经过 guard 与 dispatch 后才生效。

**核心文件**:

| 文件 | 职责 |
|---|---|
| `lib/server/priority-engine.ts` | 多因子打分:deadline 风险 / behavior vector / time lock / freeze age |
| `lib/server/schedule-planner.ts` | 调度规划,产出 insert/move/deal/reminder 等 action |
| `lib/server/freeze-return-agent.ts` | 冻结卡到点回归判断:恢复 / 拆小 / 继续等待 |
| `lib/server/agent-runtime.ts` | 16 个 skill + 6 个 trigger 的声明式注册表 + runtime guard |
| `lib/server/provider-dispatch.ts` | 把 action 派发给 Web Push / ICS Calendar |
| `components/FreezeReturnScheduler.tsx` | 客户端 setTimeout 驱动器 |

---

## 3. 三个工程决策

### 3.1 Provider Cascade(供应商降级链)

调用顺序:`NEXT_CARD_CHAT_PROVIDER` → DeepSeek → Mimo → Local Mock

**为什么**:Demo 场景下 API key 经常缺失或额度耗尽。本地 mock 不是占位符,是**完整可用的兜底**——`lib/mock-ai.ts` 实现了所有 9 个 mock 函数,产出确定性的方案,UI 永远拿到 3 个 plan。

**收益**:
- 没有任何环境变量也能 `pnpm dev` 直接体验完整流程
- 真接入后失败时不会让用户卡死,自动 fallback
- 方便单元测试和回归

### 3.2 Preview / Dispatch 二段提交

`/api/backend/worker/tick` 接受 `{ persist: boolean, dispatch: boolean }`,**默认两个都是 false**。

**为什么**:Worker tick 的输入是客户端 snapshot,如果默认就持久化或推送,任何前端 bug 都可能污染服务端状态或骚扰用户。

**实现**:
```ts
// 默认:只算不写不推
POST /api/backend/worker/tick { snapshot }

// 真要落地:显式 opt-in
POST /api/backend/worker/tick {
  snapshot,
  persist: true,    // 写 queue snapshot
  dispatch: true    // 触发 Web Push
}
```

只有 `FreezeReturnScheduler` 在到达 `returnAfter` 时才会调用 `dispatch: true`。

### 3.3 Runtime Guard(声明配置 → 运行时强制)

`lib/server/agent-runtime.ts` 不是文档,是 **运行时强制**:

```ts
applyAgentRuntimeGuard(actions, plan)
  // 把 trigger 的 queueActions 白名单作为闸门
  // action.kind 不在白名单 → 自动标 requiresUserReview = true
  // provider-dispatch 跳过任何 requiresUserReview = true 的 action
```

**收益**:`worker-tick` 不可能"不小心"产出 `reveal-hidden-goal` 把隐藏任务静默插入用户队列——即使代码 bug,guard 层也会兜住。

**6 个 trigger 的允许 action 清单**(摘录自 `agent-runtime.ts`):

| Trigger | 允许的 QueueAction | 不允许 |
|---|---|---|
| `goal-submitted` | deal-card | reminder, calendar |
| `large-import-received` | reveal-hidden-goal, deal-card | insert, move |
| `worker-tick` | insert, move, deal, reminder, calendar | hidden-reveal |
| `freeze-return-due` | return-frozen, split-frozen, keep-waiting | reminder |
| `urgency-threshold` | reminder, suggest-time-change, deal | hidden-reveal |
| `card-completed` | deal, insert | reminder |

---

## 4. 优先级引擎打分模型

`calculatePriorityVector()` 把 5 个维度加权合成最终分数:

```
deadlineRisk    × 0.35     最近的 deadline 越近分越高
behaviorPressure × 0.20    用户的拖延倾向 + 任务价值感
freezeAge        × 0.15    冻结越久越优先解冻
timeLockRisk     × 0.20    硬时间锁(课、会议)接近时优先级飙升
contextCost      × 0.10    上下文切换成本
```

具体规则:

- `deadlineRisk = 100` 当 deadline 已过期
- `deadlineRisk = 96` 当 ≤20min
- `freezeAge = +20` 每过 6 小时
- 硬时间锁 (`canAgentMove: false`) **只产 suggestion**,不会自动 move——这是死规则

**所有阈值都是常量**,可在 `lib/server/priority-engine.ts` 顶部调,不需要改其他文件。

---

## 5. 状态与持久化

### Zustand Store

`store/useNextCardStore.ts` 是单一 store,owns:

```
mode | inputs | analysis | plans | taskFlow |
deck (含 frozenTasks ledger) | proofs |
chat & clarify state machine
```

**设计原则**:
- 所有状态变更走**命名 action**,不直接 mutate UI 内部
- 异步 action 走 `requestAiTurn` 集中入口,统一处理 fallback / abort / 状态机迁移

### 持久化与版本迁移

`zustand/middleware/persist` + `localStorage`,schema 版本号 = **4**。

```ts
// v3 → v4 迁移示例
migrate(state, version) {
  if (version === 3) {
    state.deck.frozenTasks = []  // 新增字段,不破坏旧数据
  }
  return state
}
```

老用户从 v3 升级不会白屏。

### WebView 契约

`lib/webview-contract.ts` 定义了能在 Android WebView 里安全使用的 API 子集。UI 只用 ~430px 单屏布局,**没有桌面双栏**——这意味着同一份代码可以直接打包成 APK,不需要重写。

---

## 6. 安全与可观测性

| 机制 | 防御什么 |
|---|---|
| Runtime guard 白名单 | 错误的 trigger 产出敏感 action |
| `requiresUserReview` 标记 + dispatch 跳过 | 推送 / 日历写入未经用户同意 |
| `persist: false` / `dispatch: false` 默认 | 客户端 snapshot 污染服务端 |
| `CLARIFICATION_TURN_BUDGET = 5` | AI 无限反问 |
| 硬时间锁 suggest-only | 自动调度移走用户固定时间 |
| Provider fallback chain | 单个供应商挂了用户卡死 |

---

## 7. API 路由速览

```
POST /api/chat                       结构化对话(Provider cascade)
POST /api/ai/clarify                 单轮澄清
POST /api/ai/parse                   多模态导入解析
POST /api/ai/plan                    兼容版规划包(分析 + 3 方案 + 卡组 + 流程)
POST /api/agent/schedule             校验 AgentScheduleAction
POST /api/backend/worker/tick        优先级引擎 + freeze sweep(默认 preview)
POST /api/backend/freeze/return      单个冻结条目分析
POST /api/backend/schedule/plan      独立调度规划
GET  /api/backend/push/public-key    VAPID 公钥(或 configured: false)
POST /api/backend/push/subscriptions 注册 Web Push 订阅
POST /api/backend/push/send          派发单个 QueueAction
POST /api/backend/import/review      大导入 review gate
POST /api/backend/calendar/events    ICS 日历事件创建/更新
GET  /api/backend/health             健康探针
POST /api/backend/proof/export       proof 导出
```

---

## 8. 还没做完的部分

按优先级:

1. **Service Worker 客户端订阅** —— 服务端 Push 已通,客户端 subscribe 还没接
2. **服务端定时 worker tick** —— 需要 Vercel Cron 或 Node scheduler,让冻结回归在 tab 关闭时也能触发
3. **review queue 落地 proof** —— `requiresUserReview` 的 action 持久化到 proof,让用户能批准排队的提醒
4. **WebView 微调** —— drag 阈值、双/三击、WebAudio、安全区、Android 返回键

---

## 9. 工程审美的一些坚持

- **不堆抽象**:`lib/server/` 全是平铺函数,没有 class hierarchy。Service 对象只有需要复用状态时才做。
- **类型即文档**:`lib/types.ts` 是协议层,所有跨模块的数据形状都在这,改了它编译器会带你走遍所有调用点。
- **本地 mock = 一等公民**:不是为了写 unit test 才存在,是产品体验的一部分。任何接入真 AI 的代码都必须保证 mock 路径仍然可用。
- **避免万金油 prompt**:`lib/ai-prompts.ts` 里有一段反 AI 腔的禁区清单(否定排比、客服收尾、先夸再说),实测能让对话明显不像"AI 助手"。
