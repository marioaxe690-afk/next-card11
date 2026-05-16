"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FileText, ImagePlus, Menu, RotateCcw, Send, X } from "lucide-react";
import { useMemo, useRef, type ChangeEvent } from "react";
import { useNextCardStore } from "@/store/useNextCardStore";
import { CompactPlanCatalog } from "@/components/deck/CompactPlanCatalog";

const examples = ["准备高数课资料", "完成课程分析", "设置早八提醒"];

export function InputComposer() {
  const {
    inputs,
    analysis,
    taskFlow,
    deck,
    plans,
    setInputText,
    addDocumentUpload,
    addImageUpload,
    removeImageUpload,
    removeInputAttachment,
    submitGoalAndCreateDeck,
    resetInputDraft,
    openDeck,
    selectPlan,
    openOverlay
  } = useNextCardStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => Boolean(inputs.text.trim() || inputs.attachments.length > 0 || inputs.imageSchedule),
    [inputs]
  );
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId);
  const recommendedCard = activeDeck?.cards.find((card) => card.id === deck.currentCardId) ??
    activeDeck?.cards.find((card) => card.status === "active") ??
    activeDeck?.cards.find((card) => card.status === "queued") ??
    activeDeck?.cards[0];
  const hasResult = Boolean(taskFlow && analysis && activeDeck);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    submitGoalAndCreateDeck();
  };
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (file) {
      addImageUpload(file);
    }

    event.currentTarget.value = "";
  };
  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (file) {
      addDocumentUpload(file);
    }

    event.currentTarget.value = "";
  };

  return (
    <section className="phone-shell grain flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-4 pt-4">
      <div className="relative z-10 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => openOverlay("guide")}
          className="grid size-8 place-items-center rounded-full bg-[#ece5d7] text-ink transition hover:scale-95"
          aria-label="menu"
        >
          <Menu size={15} />
        </button>
        <div className="text-sm font-medium tracking-[0.01em] text-ink">Next Card</div>
        <span className="size-8" aria-hidden />
      </div>

      <div className="relative z-10 mt-5 min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {!hasResult ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full flex-col"
            >
              <div className="font-editorial text-[1.92rem] leading-[1.08] text-ink">
                现在，
                <br />
                只做一张卡。
              </div>
              <p className="mt-4 max-w-[18rem] text-[0.9rem] leading-6 text-ink/64">
                输入目标，马上得到第一步。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInputText(example)}
                    className="rounded-full border border-ink/10 bg-white/55 px-3 py-2 text-xs text-ink/76 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">行动计划</div>
                  <h1 className="mt-1 truncate font-editorial text-[1.68rem] leading-tight text-ink">
                    {taskFlow?.title ?? activeDeck?.coverTitle}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={resetInputDraft}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/62 text-ink"
                  aria-label="重新输入"
                >
                  <RotateCcw size={15} />
                </button>
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden">
                {activeDeck && (
                  <CompactPlanCatalog
                    deck={activeDeck}
                    taskFlow={taskFlow}
                    currentCardId={recommendedCard?.id ?? deck.currentCardId}
                    planOptions={plans.options}
                    selectedPlanId={plans.selectedPlanId}
                    onSelectPlan={selectPlan}
                    onOpenCard={(cardId) => openOverlay("deck-card-detail", cardId)}
                  />
                )}
              </div>

              {activeDeck && (
                <button
                  type="button"
                  onClick={() => openDeck(activeDeck.id)}
                  className="mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white shadow-[0_14px_28px_rgba(6,63,39,0.18)]"
                >
                  开始行动
                  <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!hasResult && (
        <div className="relative z-10 space-y-2">
          {(inputs.attachments.length > 0 || inputs.imageSchedule) && (
            <div className="flex flex-wrap gap-1.5">
              {inputs.imageSchedule && (
                <AttachmentChip
                  label={inputs.imageSchedule.name || "已添加图片"}
                  tone="image"
                  onRemove={() => removeImageUpload(inputs.imageSchedule?.id)}
                />
              )}
              {inputs.attachments.map((attachment) => (
                <AttachmentChip
                  key={attachment.id}
                  label={attachment.name}
                  tone="document"
                  onRemove={() => removeInputAttachment(attachment.id)}
                />
              ))}
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown"
            className="hidden"
            onChange={handleDocumentChange}
          />

          <div className="flex items-end gap-1.5 rounded-[1.7rem] border border-ink/10 bg-white/82 p-2 shadow-sm">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-ink/[0.055] text-ink/64 transition hover:bg-ink/[0.09]"
              aria-label="添加图片"
            >
              <ImagePlus size={17} />
            </button>
            <button
              type="button"
              onClick={() => documentInputRef.current?.click()}
              className="mb-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-ink/[0.055] text-ink/64 transition hover:bg-ink/[0.09]"
              aria-label="添加文档"
            >
              <FileText size={17} />
            </button>
            <textarea
              value={inputs.text}
              onChange={(event) => setInputText(event.target.value)}
              onInput={(event) => setInputText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  handleSubmit();
                }
              }}
              placeholder="输入一个目标"
              className="min-h-12 flex-1 bg-transparent px-1.5 py-2 text-[0.95rem] leading-5 text-ink outline-none placeholder:text-ink/34"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mb-0.5 flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white transition hover:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/26"
            >
              <span>生成</span>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AttachmentChip({
  label,
  tone,
  onRemove
}: {
  label: string;
  tone: "image" | "document";
  onRemove: () => void;
}) {
  const Icon = tone === "image" ? ImagePlus : FileText;

  return (
    <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-ink/10 bg-white/68 py-1 pl-2.5 pr-1 text-xs font-semibold text-ink/66 shadow-sm">
      <Icon size={13} className="shrink-0" />
      <span className="max-w-[12rem] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-ink/54"
        aria-label={`移除 ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}
