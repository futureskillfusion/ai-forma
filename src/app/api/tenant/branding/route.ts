import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireTenantUser, toErrorResponse } from "@/lib/rbac";
import { readJson } from "@/lib/http";

// Branding is editable by the tenant only within super-admin-allowed limits.
// Plan tier / feature flags / API keys are never touched here.
const Body = z.object({
  logoUrl: z.string().url().max(500).or(z.literal("")).optional(),
  primaryColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour like #2563EB"),
});

export async function PATCH(req: Request) {
  try {
    const s = await apiRequireTenantUser(["tenant_admin"]);
    const body = await readJson(req, Body);
    const tenant = await db.tenant.update({
      where: { id: s.tenantId },
      data: {
        primaryColor: body.primaryColor,
        logoUrl: body.logoUrl ? body.logoUrl : null,
      },
      select: { primaryColor: true, logoUrl: true },
    });
    return Response.json({ tenant });
  } catch (err) {
    return toErrorResponse(err);
  }
}
