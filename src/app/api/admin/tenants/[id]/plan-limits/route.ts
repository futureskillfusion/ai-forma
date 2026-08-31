import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { writeAudit } from "@/lib/platform";

const Body = z.object({
  maxQueriesPerMonth: z.number().int().min(0).max(1_000_000),
  maxRegenerationRounds: z.number().int().min(1).max(20),
  imageModelTier: z.enum(["standard", "premium"]),
  designerSeats: z.number().int().min(1).max(500),
  overagePolicy: z.enum(["hard_cutoff", "auto_upgrade_prompt", "metered_billing"]),
  monthlyCostCapUsd: z.number().min(0).max(1_000_000),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await apiRequireSuperAdmin();
    const { id } = await params;
    const body = await readJson(req, Body);

    const tenant = await db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new HttpError(404, "Tenant not found");

    const limit = await db.planLimit.upsert({
      where: { tenantId: id },
      create: { tenantId: id, planTier: tenant.planTier, ...body },
      update: body,
    });

    await writeAudit({
      actorId: admin.sub,
      action: "plan_limits_updated",
      targetTenant: id,
      metadata: body,
    });

    return Response.json({ planLimit: limit });
  } catch (err) {
    return toErrorResponse(err);
  }
}
