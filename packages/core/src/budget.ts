export interface BudgetState {
  spentDayUsd: number;
  spentMonthUsd: number;
  dailyCapUsd: number;
  monthlyCapUsd: number;
}

export function budgetAllows(state: BudgetState, nextCostUsd: number): { ok: true } | { ok: false; reason: string } {
  if (nextCostUsd < 0) return { ok: false, reason: "Cost estimate is invalid" };
  if (state.spentDayUsd + nextCostUsd > state.dailyCapUsd) {
    return { ok: false, reason: "Daily API budget is exhausted" };
  }
  if (state.spentMonthUsd + nextCostUsd > state.monthlyCapUsd) {
    return { ok: false, reason: "Monthly API budget is exhausted" };
  }
  return { ok: true };
}

export function backoffSeconds(attempt: number): number {
  const capped = Math.min(Math.max(attempt, 1), 6);
  return 2 ** capped;
}
