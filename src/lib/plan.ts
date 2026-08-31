import "server-only";
import type { PlanLimit, PlanTier, Tenant } from "@prisma/client";
import { db } from "./db";
import { tenantMonthlyQueryCount } from "./usage";

/**
 * Resolve the effective plan limit for a tenant: a tenant-specific PlanLimit row
 * wins; otherwise fall back to the tier-default row (tenantId = null).
 */
export async function resolvePlanLimit(tenant: Pick<Tenant, "id" | "planTier">): Promise<PlanLimit> {
  const own = await db.planLimit.findUnique({ where: { tenantId: tenant.id } });
  if (own) return own;
  const def = await db.planLimit.findFirst({
    where: { tenantId: null, planTier: tenant.planTier },
  });
  if (!def) {
    throw new Error(`No PlanLimit configured for tier "${tenant.planTier}" and no tenant override.`);
  }
  return def;
}

export type QuotaCheck =
  | { allowed: true; used: number; cap: number; remaining: number }
  | {
      allowed: false;
      used: number;
      cap: number;
      remaining: 0;
      policy: PlanLimit["overagePolicy"];
      reason: string;
    };

/** Enforced server-side before any billable generation is triggered. */
export async function checkQueryQuota(
  tenant: Pick<Tenant, "id" | "planTier">,
  limit: PlanLimit,
): Promise<QuotaCheck> {
  const used = await tenantMonthlyQueryCount(tenant.id);
  const cap = limit.maxQueriesPerMonth;
  const remaining = Math.max(0, cap - used);
  if (used < cap) return { allowed: true, used, cap, remaining };
  return {
    allowed: false,
    used,
    cap,
    remaining: 0,
    policy: limit.overagePolicy,
    reason:
      limit.overagePolicy === "hard_cutoff"
        ? "Monthly query limit reached. New intakes are paused until the plan resets or is upgraded."
        : limit.overagePolicy === "auto_upgrade_prompt"
          ? "Monthly query limit reached. Upgrade the plan to keep accepting intakes."
          : "Monthly query limit reached. Additional intakes will be billed as metered overage.",
  };
}

export const TIER_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};
