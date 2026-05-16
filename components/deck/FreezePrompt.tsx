"use client";

import { Snowflake } from "lucide-react";

type FreezePromptProps = {
  onContinue: () => void;
  onFreeze: () => void;
};

export function FreezePrompt({ onContinue, onFreeze }: FreezePromptProps) {
  return (
    <div className="rounded-[1.4rem] border border-sky-200 bg-[#eefbff] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-sky-700">
          <Snowflake size={19} />
        </div>
        <div className="min-w-0">
          <h3 className="font-editorial text-[1.35rem] leading-tight text-ink">你还想继续完成这个任务吗？</h3>
          <p className="mt-2 text-sm leading-6 text-ink/62">
            冻结会保存当前上下文，加入重新安排队列；继续完成会保留这张卡并软化压力。
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="h-10 rounded-full border border-ink/10 bg-white text-sm font-semibold text-ink"
        >
          继续完成
        </button>
        <button
          type="button"
          onClick={onFreeze}
          className="h-10 rounded-full bg-ink text-sm font-semibold text-white"
        >
          先冻结
        </button>
      </div>
    </div>
  );
}
