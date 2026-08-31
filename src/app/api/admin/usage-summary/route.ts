import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse } from "@/lib/rbac";
import { monthRange } from "@/lib/usage";

export async function GET() {
  try {
    await apiRequireSuperAdmin();
    const { start, end } = monthRange();

    const tenants = await db.tenant.findMany();
    const activeRetainer = tenants
      .filter((t) => t.status !== "suspended")
      .reduce((sum, t) => sum + Number(t.retainerAmount), 0);

    const spendByVendor = await db.usageLog.groupBy({
      by: ["vendor"],
      where: { createdAt: { gte: start, lt: end } },
      _sum: { costUsd: true },
    });
    const totalSpend = spendByVendor.reduce((s, r) => s + Number(r._sum.costUsd ?? 0), 0);

    const queriesThisMonth = await db.query.count({
      where: { createdAt: { gte: start, lt: end } },
    });

    return Response.json({
      period: { start, end },
      revenueUsd: activeRetainer,
      spendUsd: totalSpend,
      marginUsd: activeRetainer - totalSpend,
      marginPct: activeRetainer > 0 ? ((activeRetainer - totalSpend) / activeRetainer) * 100 : 0,
      tenantCount: tenants.length,
      activeTenantCount: tenants.filter((t) => t.status === "active").length,
      queriesThisMonth,
      spendByVendor: spendByVendor.map((r) => ({
        vendor: r.vendor,
        costUsd: Number(r._sum.costUsd ?? 0),
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
