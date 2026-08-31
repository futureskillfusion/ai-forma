import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { writeAudit } from "@/lib/platform";

const Body = z.object({
  status: z.enum(["active", "suspended"]),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await apiRequireSuperAdmin();
    const { id } = await params;
    const { status, reason } = await readJson(req, Body);

    const tenant = await db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new HttpError(404, "Tenant not found");

    const updated = await db.tenant.update({ where: { id }, data: { status } });
    await writeAudit({
      actorId: admin.sub,
      action: status === "suspended" ? "tenant_suspended" : "tenant_reactivated",
      targetTenant: id,
      reason,
    });

    return Response.json({ tenant: { id: updated.id, status: updated.status } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
