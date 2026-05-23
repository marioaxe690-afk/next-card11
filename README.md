<div align="center">

# Next Card

**把模糊的目标,变成可滑动的卡组,变成可见的行动证据。**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-online-success?logo=vercel)](https://next-card11-marioaxe690-afk.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Zustand](https://img.shields.io/badge/Zustand-5-orange)](https://github.com/pmndrs/zustand)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

**🚀 [在线 Demo](https://next-card11-marioaxe690-afk.vercel.app)** · [English](./README.en.md) · [架构文档](./docs/ARCHITECTURE.md) · [产品契约](./docs/PRD.md)

> 推荐用手机或浏览器开发者工具开启移动模拟(~430px 宽)体验,这是为单屏 WebView 设计的应用。

</div>

---

## 灵感来源

我是工商管理专业大一学生,从入学开始就在和**执行力低**这个问题死磕——

- 作业要写 3000 字读后感,光看到"3000 字"四个字就动不了
- 老师布置"读完《管理学原理》第一章并做思维导图",我在脑子里把它堆成一座山,然后躺床上刷手机
- 有时候明明有 3 小时空档,却一件事没做就过去了

我意识到不是我懒——而是**任务被描述得太大、太抽象、没有"下一步"**。一个"读完第一章"在心里其实是 50 个微动作,但没人帮我拆,我也不知道哪个先做。

Todo App 解决不了这个——它把"读完第一章"原封不动放进列表,然后用红色感叹号让我更焦虑。

所以我用 [Codex](https://openai.com/codex)、[Claude Code](https://www.anthropic.com/claude-code) 和 ChatGPT,以 Vibe Coding 的方式一步步做了 Next Card——

- **AI 把目标拆到"下一步动作"**:不是"读完第一章",而是"打开书,翻到第 1 页,读 10 分钟"
- **任务卡片自己显示燃烧/冻结**:把时间压力翻译成视觉,引导而不是羞辱
- **每个动作写进 proof**:看得见自己今天真的做了什么,不是又一行被划掉的字

---

## 这是什么

Next Card 不是又一个 Todo App。它面对一个具体的人:**有一件想做但动不起来的事**——可能是赶 ddl、要去一节快迟到的课、或者一个含糊的"今天该推一下"。

输入一句话,AI 给三套**已经拆解到下一步动作**的方案;选一个之后,任务变成可滑动的卡组,卡片自己显示燃烧/冻结/裂痕来表达时间压力,而不是用红色感叹号让你愧疚;每完成、冻结、燃烧、重新安排一次,**都被写进 proof 里成为可见证据**。

> *"今天你完成了 2 个阶段目标,1 张卡用快速燃烧模式在 6 分钟内完成最低可行动作,1 张卡选择了先冻结,系统已保留上下文,适合明天继续。"*

这是 proof 在每一次行动之后给你的总结——不是 XP、不是连击、不是徽章,**是把行为变成可读的故事**。

---

## 三个画面

<table>
<tr>
<td width="33%" align="center"><b>input</b><br/>ChatGPT 风格的 composer<br/>AI 用 Plan Mode 出三套方案</td>
<td width="33%" align="center"><b>deck</b><br/>Reigns 风格的单卡决策面<br/>滑动 / 双击 / 三击 / 下拉冻结</td>
<td width="33%" align="center"><b>proof</b><br/>彩色表 + 图表 + 博客式日志<br/>AI 总结今天发生了什么</td>
</tr>
<tr>
<td><img src="./docs/screenshots/01-input.png" alt="Input mode" /></td>
<td><img src="./docs/screenshots/02-deck.png" alt="Deck mode" /></td>
<td><img src="./docs/screenshots/03-proof.png" alt="Proof mode" /></td>
</tr>
</table>

> 截图来自本地 Demo,使用本地 mock AI 生成,无需任何 API key 即可复现。

---

## 为什么不是又一个 Todo

| Todo App 的问题 | Next Card 的回应 |
|---|---|
| 把"学高数"写进列表,但你不会因此动起来 | AI 把目标拆成"圈出作业要求里必须提交的 3 个点"这种**下一步动作** |
| 红色 ddl + 未完成数量 = 愧疚机器 | 时间压力变成卡片**燃烧/冻结/裂痕**的视觉,引导而非羞辱 |
| 完成了打个勾,没有积累感 | 每个动作写入 proof,**行为变成可见证据**而不是被划掉的一行 |
| 卡住了只能放着烂 | **冻结**会保留上下文,到点之后 AI 重新分析:恢复 / 拆小 / 继续等待 |

---

## 工程亮点

> 想直接看代码地图,跳到 [架构文档](./docs/ARCHITECTURE.md)。

### 双 Agent 架构

不是一个万能 LLM 调用包一切,而是两个职责独立的 Agent:

- **Agent 1 — 澄清与规划**(`lib/server/plan-mode-service.ts`):四阶段状态机 `thinking → asking → generating → ready`,前后端共享 `CLARIFICATION_TURN_BUDGET = 5` 强制收束,**禁止无限反问**
- **Agent 2 — 调度与推送**(`lib/server/schedule-planner.ts` + `priority-engine.ts`):产出 `QueueAction[]`,经过 runtime guard 才能落地

边界用类型化协议传递,`lib/types.ts` 是协议层。

### Provider Cascade(供应商降级链)

```
NEXT_CARD_CHAT_PROVIDER → DeepSeek → Mimo → Local Mock
```

无 API key 也能跑完整流程——`lib/mock-ai.ts` 是**完整可用的兜底**,产出确定性方案,UI 永远拿到 3 个 plan。这意味着你 clone 下来 `pnpm dev` 立即就能完整体验,不用配任何环境变量。

### Runtime Guard(声明配置 → 运行时强制)

`lib/server/agent-runtime.ts` 不是文档,是**运行时强制**。16 个 skill × 6 个 trigger 的注册表,`applyAgentRuntimeGuard()` 把 trigger 的 action 白名单作为闸门:

```ts
// worker-tick 不可能"不小心"产出 reveal-hidden-goal
// 即使代码 bug,guard 层也会兜住,标 requiresUserReview = true
// provider-dispatch 跳过任何 requiresUserReview = true 的 action
```

### Preview / Dispatch 二段提交

`/api/backend/worker/tick` 默认 `persist: false, dispatch: false`——**任何前端 bug 都污染不了服务端状态,也骚扰不到用户**。只有 `FreezeReturnScheduler` 在到达 returnAfter 时才显式 opt-in。

### 多因子优先级引擎

`calculatePriorityVector()` 把 5 个维度加权:

```
deadlineRisk × 0.35  +  behaviorPressure × 0.20  +
freezeAge × 0.15  +  timeLockRisk × 0.20  +  contextCost × 0.10
```

硬时间锁 (`canAgentMove: false`) **只产 suggestion**,不会自动 move——这是死规则。

### 6 个 Agent Persona,各自带技能权重

`balanced-coach / deadline-guardian / micro-splitter / sprint-driver / gentle-recovery / meaning-coach` —— 每个 persona 有自己的 `skillWeights` 表(微动作拆牌权重 0.96 / 0.55,deadline 保护 0.95 / 0.28),适配不同场景。

### 反 AI 腔的 Prompt 工程

`lib/ai-prompts.ts` 里有一段直接禁用的句式清单——否定排比("不是 X,而是 Y")、万金油("具体情况而异")、客服收尾("还有什么我能帮您的吗")——实测让对话明显不像 AI 助手。

### Zustand Schema 版本迁移

持久化 schema 版本号 = 4。v3 → v4 迁移自动 backfill `frozenTasks: []`,**老用户从 v3 升级不会白屏**。

### 移动 WebView 单屏契约

`lib/webview-contract.ts` 定义了能在 Android WebView 里安全使用的 API 子集。UI 只用 ~430px 单屏布局——**同一份代码可以直接打包成 APK,不需要重写**。

---

## 技术栈

| 层 | 选型 | 选它的理由 |
|---|---|---|
| 框架 | Next.js 15 App Router | Route Handlers + Node runtime 同时承载前端与 Agent 服务 |
| 语言 | TypeScript 5.9 | 协议层 (`lib/types.ts`) 即文档 |
| 状态 | Zustand 5 + persist | 中等复杂度的最佳点;比 Redux 轻,比 Context 稳 |
| 样式 | Tailwind 3.4 | 卡片视觉细节多,utility-first 最快 |
| 动效 | Framer Motion 12 | 滑动手势 + spring 物理 + layout 动画一站式 |
| 图标 | lucide-react | 风格统一、tree-shake 友好 |
| 推送 | web-push (VAPID) | 标准化、跨浏览器、无供应商锁定 |
| 日历 | ics | 生成标准 ICS,任何日历都能导入 |
| LLM | DeepSeek / Mimo / Local Mock | Cascade 降级,Demo 永远可跑 |

---

## 快速开始

```bash
# 安装
pnpm install

# 启动(无需任何环境变量,本地 mock 即可完整体验)
pnpm dev          # http://127.0.0.1:3000

# 构建
pnpm build

# Lint
pnpm lint
```

### 想接入真 AI(可选)

```bash
# .env.local
DEEPSEEK_API_KEY=sk-...               # 接入 DeepSeek
DEEPSEEK_MODEL=deepseek-chat          # 默认 deepseek-chat

# 或者 Mimo
MIMO_API_KEY=...
MIMO_BASE_URL=...

# 二者都没设,自动 fallback 到本地 mock
```

完整环境变量列表见 [docs/PRD.md 末尾](./docs/PRD.md#optional-environment-variables) 或源码 `lib/server/compat-ai-service.ts`。

---

## 项目结构

```
next-card11/
├── app/                          # Next.js App Router
│   ├── api/                      # Route Handlers
│   │   ├── chat/                 #   Agent 1 入口
│   │   ├── ai/                   #   澄清 / 解析 / 规划
│   │   ├── agent/                #   AgentScheduleAction 校验
│   │   └── backend/              #   Agent 2:worker/freeze/push/calendar
│   ├── layout.tsx
│   └── page.tsx                  # 单页模式切换
│
├── components/
│   ├── input/                    # ChatPanel / ClarifyingPanel / PlanChoicePanel
│   ├── deck/                     # SwipeTaskCard / FreezePrompt / RewardCard
│   ├── flow/                     # TaskFlowOverview
│   ├── proof/                    # ProofDashboard
│   ├── TopModeTabs.tsx           # input / deck / proof
│   └── FreezeReturnScheduler.tsx # 客户端定时驱动
│
├── lib/
│   ├── types.ts                  # 协议层
│   ├── ai-prompts.ts             # System prompt + 反 AI 腔禁区
│   ├── mock-ai.ts                # 本地兜底(完整可用)
│   ├── ai-client.ts              # 客户端调用封装
│   ├── card-time-engine.ts       # 燃烧/冻结/裂痕状态机
│   ├── webview-contract.ts       # WebView API 契约
│   └── server/                   # Agent 2 调度引擎
│       ├── agent-runtime.ts      # ★ 16 skill × 6 trigger + runtime guard
│       ├── priority-engine.ts    # ★ 多因子优先级打分
│       ├── schedule-planner.ts   # ★ 产出 QueueAction[]
│       ├── freeze-return-agent.ts
│       ├── plan-mode-service.ts  # Agent 1 状态机
│       ├── compat-ai-service.ts  # Provider cascade
│       └── providers/            # Web Push / ICS Calendar
│
├── store/
│   └── useNextCardStore.ts       # Zustand + persist (schema v4)
│
└── docs/
    ├── PRD.md                    # 产品契约(原 AGENTS.md)
    ├── ARCHITECTURE.md           # 系统设计文档
    └── screenshots/              # 截图
```

---

## 路线图

**已完成**

- [x] Plan Mode 四阶段对话状态机
- [x] 6 个 Agent persona × 16 个 skill 注册表
- [x] 优先级引擎 + freeze return + ICS 导出
- [x] Runtime guard + preview/dispatch 二段提交
- [x] Zustand persist 版本迁移 (v3→v4)
- [x] Provider cascade (DeepSeek / Mimo / Local Mock)

**进行中 / 计划中**

- [ ] 客户端 Service Worker 订阅(服务端 Push 已通)
- [ ] 服务端定时 worker tick(Vercel Cron / Node scheduler)
- [ ] `requiresUserReview` 落地到 proof 的 review queue
- [ ] WebView 微调:drag 阈值 / 双/三击 / WebAudio / 安全区 / Android back
- [ ] Android APK 打包脚本

---

## 文档地图

| 文档 | 看什么 |
|---|---|
| [README.md](./README.md) | 你在这里 |
| [README.en.md](./README.en.md) | English version |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统设计、双 Agent 边界、安全机制 |
| [docs/PRD.md](./docs/PRD.md) | 产品规则、卡片状态、验收标准(给 AI Coding Agent) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献指南 |

---

## 关于作者

[@marioaxe690-afk](https://github.com/marioaxe690-afk) · 工商管理大一在读

这个仓库不是"AI 帮我写代码",而是**我主导产品判断,AI 协作完成实现**:

- **产品定位、双 Agent 边界、runtime guard、provider cascade、反 AI 腔的 prompt 禁区**——这些判断由我做出
- **代码生成、重构、调试**——协同使用 [Codex](https://openai.com/codex)、[Claude Code](https://www.anthropic.com/claude-code)、ChatGPT,按任务类型挑工具
- **prompt 工程、状态机、类型设计**——在 AI 工具里反复打磨成型

我相信对初创公司来说,真正稀缺的不是"会写代码的人",而是**会判断什么该做、什么不该做、能让 AI 工具产出可信结果的人**。这个项目是我这个能力的具体证据。

联系方式:

- GitHub Issues:[next-card11/issues](https://github.com/marioaxe690-afk/next-card11/issues)
- Email:marioaxe690@gmail.com

如果觉得有意思,star 一下会让我开心很久。

---

## License

[MIT](./LICENSE)
