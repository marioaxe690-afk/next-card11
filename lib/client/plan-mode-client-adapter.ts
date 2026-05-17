import type { AnalysisResult, PlanModeTurnResult, PlansState } from "@/lib/types";

export function mergeBackendPlanModeResult(input: {
  analysis: AnalysisResult;
  plans: PlansState;
  backendResult: PlanModeTurnResult;
}): { analysis: AnalysisResult; plans: PlansState } {
  const backendAnalysis = input.backendResult.analysis;
  const buildOptions = input.backendResult.options.filter((option) => option.kind === "build").slice(0, 3);
  const constraints = backendAnalysis.knownConstraints.length > 0 ? backendAnalysis.knownConstraints : input.analysis.constraints;
  const timeStrategy = [
    backendAnalysis.timeJudgement,
    dealModeLabel(backendAnalysis.recommendedDealMode),
    ...backendAnalysis.missingInformation.map((item) => `缺口：${item}`)
  ].filter(Boolean);
  const options = input.plans.options.map((option, index) => {
    const backendOption = buildOptions[index];

    if (!backendOption) {
      return option;
    }

    return {
      ...option,
      name: backendOption.label || option.name,
      summary: backendOption.description || option.summary
    };
  });

  return {
    analysis: {
      ...input.analysis,
      goalUnderstanding: backendAnalysis.goalUnderstanding || input.analysis.goalUnderstanding,
      constraints,
      timeStrategy: timeStrategy.length > 0 ? timeStrategy : input.analysis.timeStrategy
    },
    plans: {
      ...input.plans,
      goalUnderstanding: backendAnalysis.goalUnderstanding || input.plans.goalUnderstanding,
      constraints,
      timeStrategy: timeStrategy.length > 0 ? timeStrategy : input.plans.timeStrategy,
      options
    }
  };
}

function dealModeLabel(mode: PlanModeTurnResult["analysis"]["recommendedDealMode"]) {
  if (mode === "deal-two-cards") {
    return "发牌策略：先保留 1-2 张可执行牌，其余后台拆分。";
  }

  if (mode === "review-before-deal") {
    return "发牌策略：大导入先 review，再发第一张牌。";
  }

  return "发牌策略：先发第一张行动牌，其他后台拆分。";
}
