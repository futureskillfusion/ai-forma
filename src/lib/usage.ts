import "server-only";
import type { Prisma, UsageVendor } from "@prisma/client";
import { db } from "./db";

/**
 * Every external call that has a per-unit cost MUST go through here so the super
 * admin margin dashboard stays accurate. Call this immediately after the vendor
 * call resolves.
 */
export async function logUsage(input: {
  tenantId: string;
  queryId?: string | null;
  vendor: UsageVendor;
  costUsd: number;
  tokensOrUnits?: number;
  meta?: Prisma.InputJsonValue;
}) {
  await db.usageLog.create({
    data: {
      tenantId: input.tenantId,
      queryId: input.queryId ?? null,
      vendor: input.vendor,
      costUsd: input.costUsd,
      tokensOrUnits: input.tokensOrUnits ?? 0,
      meta: input.meta,
    },
  });
}

export function monthRange(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { start, end };
}

/** Summed spend for a tenant in the given month (defaults to current). */
export async function tenantMonthlySpend(tenantId: string, ref = new Date()): Promise<number> {
  const { start, end } = monthRange(ref);
  const agg = await db.usageLog.aggregate({
    where: { tenantId, createdAt: { gte: start, lt: end } },
    _sum: { costUsd: true },
  });
  return Number(agg._sum.costUsd ?? 0);
}

/** Query count for a tenant in the given month. */
export async function tenantMonthlyQueryCount(tenantId: string, ref = new Date()): Promise<number> {
  const { start, end } = monthRange(ref);
  return db.query.count({ where: { tenantId, createdAt: { gte: start, lt: end } } });
}
