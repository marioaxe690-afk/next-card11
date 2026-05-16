"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, GitBranch, RefreshCcw } from "lucide-react";
import { useNextCardStore } from "@/store/useNextCardStore";
import { PlanOptionCard } from "@/components/input/PlanOptionCard";

export function PlanModePanel() {
  const { analysis, analysisStatus, plans, regeneratePlans, selectPlan } = useNextCardStore();

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white/56 p-4 shadow-soft backdrop-blur">
      <AnimatePresence mode="popLayout">
        {analysisStatus === "idle" && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex min-h-[28rem] flex-col justify-between rounded-[1.55rem] border border-dashed border-ink/16 bg-[#fff8f1]/64 p-5"
          >
            <div>
              <div className="font-editorial text-[1.85rem] leading-tight text-ink">
                Plan Mode
                <br />
                waits for one clear signal.
              </div>
              <p className="mt-4 max-w-[29rem] text-sm leading-6 text-ink/64">
                输入侧会先收集目标或课表。提交后，这里才会开始显示理解、约束、阶段拆解和三套方案。
              </p>
            </div>
            <div className="grid gap-3">
              {["understand", "decompose", "choose"].map((item) => (
                <div key={item} className="rounded-[1.2rem] border border-ink/8 bg-white/58 p-4 text-sm font-medium text-ink/58">
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {analysisStatus === "analyzing" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid min-h-[28rem] place-items-center rounded-[1.55rem] bg-[#fff8f1]/70 p-6 text-center"
          >
            <div>
              <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-ink text-white shadow-[0_18px_36px_rgba(6,63,39,0.2)]">
                <GitBranch className="animate-pulse" size={26} />
              </div>
              <h2 className="font-editorial text-[1.95rem] leading-tight text-ink">正在理解目标</h2>
              <p className="mx-auto mt-3 max-w-[27rem] text-sm leading-6 text-ink/62">
                先找时间、难度、依赖和能量压力。不会立刻甩出一堆 Todo。
              </p>
              <div className="mx-auto mt-7 h-2 max-w-[18rem] overflow-hidden rounded-full bg-ink/8">
                <motion.div
                  className="h-full rounded-full bg-ink"
                  initial={{ width: "8%" }}
                  animate={{ width: "84%" }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {analysisStatus === "ready" && analysis && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-5"
          >
            <div className="rounded-[1.55rem] border border-ink/8 bg-[#fff8f1]/78 p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-fern">
                <Clock3 size={14} />
                extracted time
              </div>
              <h2 className="font-editorial text-[1.58rem] leading-tight text-ink">{analysis.goalUnderstanding}</h2>
              <div className="mt-5 grid gap-3">
                <TimeChip label="deadline" value={analysis.deadlineLabel} />
                <TimeChip label="window" value={analysis.availableWindow} />
                <TimeChip label="start" value={analysis.suggestedStart} />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="space-y-4">
                <InfoBlock title="关键约束" items={plans.constraints} />
                <InfoBlock title="时间策略" items={plans.timeStrategy} />
              </div>

              <div className="space-y-4">
                <div className="grid gap-3">
                  {plans.options.map((option, index) => (
                    <PlanOptionCard
                      key={`${option.id}-${plans.regenerateCount}`}
                      option={option}
                      selected={plans.selectedPlanId === option.id}
                      buttonLabel={`执行方案${["一", "二", "三"][index]}`}
                      onSelect={selectPlan}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={regeneratePlans}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/12 bg-white/70 text-sm font-semibold text-ink transition hover:bg-white"
                >
                  <RefreshCcw size={15} />
                  否，重新生成
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function TimeChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.05rem] border border-ink/8 bg-white/64 px-3 py-3">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink/38">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-5 text-ink">{value}</div>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.35rem] border border-ink/8 bg-white/60 p-4">
      <h3 className="font-editorial text-[1.35rem] text-ink">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-[0.9rem] bg-ink/[0.045] px-3 py-2 text-sm leading-5 text-ink/70">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
