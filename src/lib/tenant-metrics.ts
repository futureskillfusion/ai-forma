import "server-only";
import type { Tenant } from "@prisma/client";
import { db } from "./db";
import { monthRange } from "./usage";
import { resolvePlanLimit } from "./plan";

export interface TenantMetrics {
  monthSpendUsd: number;
  monthQueryCount: number;
  retainerUsd: number;
  marginUsd: number;
  marginPct: number;
  queryCap: number;
  costCapUsd: number;
  overCostCap: boolean;
}

/** Cost / margin figures for one tenant in the current month. */
export async function tenantMetrics(tenant: Tenant): Promise<TenantMetrics> {
  const { start, end } = monthRange();
  const [spendAgg, queryCount, limit] = await Promise.all([
    db.usageLog.aggregate({
      where: { tenantId: tenant.id, createdAt: { gte: start, lt: end } },
      _sum: { costUsd: true },
    }),
    db.query.count({ where: { tenantId: tenant.id, createdAt: { gte: start, lt: end } } }),
    resolvePlanLimit(tenant),
  ]);

  const monthSpendUsd = Number(spendAgg._sum.costUsd ?? 0);
  const retainerUsd = Number(tenant.retainerAmount);
  const marginUsd = retainerUsd - monthSpendUsd;
  const costCapUsd = Number(limit.monthlyCostCapUsd);

  return {
    monthSpendUsd,
    monthQueryCount: queryCount,
    retainerUsd,
    marginUsd,
    marginPct: retainerUsd > 0 ? (marginUsd / retainerUsd) * 100 : 0,
    queryCap: limit.maxQueriesPerMonth,
    costCapUsd,
    overCostCap: monthSpendUsd > costCapUsd,
  };
}
