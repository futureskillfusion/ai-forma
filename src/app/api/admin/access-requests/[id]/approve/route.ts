import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { writeAudit } from "@/lib/platform";
import { provisionTenant } from "@/lib/provisioning";

const Body = z.object({
  planTier: z.enum(["starter", "pro", "enterprise"]),
  retainerAmount: z.number().positive().max(100000),
  adminName: z.string().min(2).max(120).optional(),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(8).max(200),
  embedAllowedOrigins: z.array(z.string().url()).default([]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await apiRequireSuperAdmin();
    const { id } = await params;
    const body = await readJson(req, Body);

    const request = await db.accessRequest.findUnique({ where: { id } });
    if (!request) throw new HttpError(404, "Access request not found");
    if (request.status !== "pending") {
      throw new HttpError(409, `This request is already ${request.status}`);
    }

    const result = await provisionTenant({
      businessName: request.businessName,
      planTier: body.planTier,
      retainerAmount: body.retainerAmount,
      adminName: body.adminName || request.contactName,
      adminEmail: body.adminEmail || request.email,
      adminPassword: body.adminPassword,
      embedAllowedOrigins: body.embedAllowedOrigins.length
        ? body.embedAllowedOrigins
        : request.website
          ? [request.website]
          : [],
    });

    await db.accessRequest.update({
      where: { id },
      data: {
        status: "approved",
        tenantId: result.tenantId,
        reviewedByEmail: admin.email,
        reviewedAt: new Date(),
      },
    });

    await writeAudit({
      actorId: admin.sub,
      action: "access_request_approved",
      targetTenant: result.tenantId,
      metadata: { businessName: request.businessName, planTier: body.planTier },
    });

    return Response.json({ tenant: result }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
