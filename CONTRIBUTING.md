# Contributing to Next Card

感谢你对 Next Card 感兴趣 / Thanks for your interest!

## 提交流程 / Workflow

1. Fork & clone 本仓库
2. 创建分支:`git checkout -b feat/your-feature` 或 `fix/issue-number`
3. 改完后跑 `pnpm lint` 和 `pnpm build` 确认通过
4. 提交 PR,描述清楚动机与做了什么

## Commit message 风格

参考 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 新功能
fix:  修复 bug
docs: 文档变更
refactor: 重构(无功能变化)
chore: 杂项(依赖、配置)
test: 测试相关
```

## 在动手之前请先读

- [README.md](./README.md) — 项目是什么、怎么跑
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 双 Agent 边界、安全机制
- [docs/PRD.md](./docs/PRD.md) — 产品规则与不可妥协约束

## 改 Agent 相关代码的注意事项

由于本项目用 runtime guard 把声明配置变成运行时强制,**改 `lib/server/agent-runtime.ts` 时要同步检查**:

- 新增 trigger:在 `AGENT_AUTO_TRIGGERS` 中明确 `queueActions` 白名单
- 新增 skill:确认 `canMutateQueue` 与 `requiresUserReview` 标记
- 新增 QueueAction kind:加进 `lib/types.ts`,并在所有相关 trigger 的白名单里显式列出

guard 的核心约定是:**白名单之外的所有 action 自动标 requiresUserReview**——这是一个故意保守的默认。

## 改 prompt 的注意事项

`lib/ai-prompts.ts` 里的禁区清单是**实测有效**的反 AI 腔规则。改它前请:

- 想清楚为什么要改、改完会让对话哪里更好
- 跑完整的 input → plan 流程至少 3 次,确认 AI 没回到客服腔

## 改持久化 schema 的注意事项

如果改了 `useNextCardStore` 的持久化结构,**必须**:

1. 在 `version` 字段递增(目前是 4)
2. 在 `migrate()` 函数里写从旧版到新版的迁移逻辑
3. 在本地用旧版 localStorage 跑一次,确认升级不白屏

## 报 issue

用仓库的 [issue 模板](./.github/ISSUE_TEMPLATE/) 提交 bug 或 feature request。

## License

贡献的代码遵循本项目的 [MIT License](./LICENSE)。
