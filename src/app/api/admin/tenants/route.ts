import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { writeAudit } from "@/lib/platform";
import { tenantMetrics } from "@/lib/tenant-metrics";
import { provisionTenant } from "@/lib/provisioning";

export async function GET() {
  try {
    await apiRequireSuperAdmin();
    const tenants = await db.tenant.findMany({ orderBy: { createdAt: "desc" } });
    const rows = await Promise.all(
      tenants.map(async (t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        planTier: t.planTier,
        status: t.status,
        subscriptionStatus: t.subscriptionStatus,
        metrics: await tenantMetrics(t),
      })),
    );
    return Response.json({ tenants: rows });
  } catch (err) {
    return toErrorResponse(err);
  }
}

const CreateBody = z.object({
  name: z.string().min(2).max(80),
  planTier: z.enum(["starter", "pro", "enterprise"]),
  retainerAmount: z.number().positive().max(100000),
  adminName: z.string().min(2).max(80),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(200),
  embedAllowedOrigins: z.array(z.string().url()).default([]),
});

export async function POST(req: Request) {
  try {
    const admin = await apiRequireSuperAdmin();
    const body = await readJson(req, CreateBody);

    const result = await provisionTenant({
      businessName: body.name,
      planTier: body.planTier,
      retainerAmount: body.retainerAmount,
      adminName: body.adminName,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      embedAllowedOrigins: body.embedAllowedOrigins,
    });

    await writeAudit({
      actorId: admin.sub,
      action: "tenant_created",
      targetTenant: result.tenantId,
      metadata: { planTier: body.planTier, retainerAmount: body.retainerAmount },
    });

    return Response.json({ tenant: result }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
