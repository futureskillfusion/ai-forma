import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { slugify } from "@/lib/slug";
import { billing } from "@/lib/adapters";
import { writeAudit } from "@/lib/platform";
import { tenantMetrics } from "@/lib/tenant-metrics";

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

    let slug = slugify(body.name);
    if (!slug) slug = `tenant-${nanoid(6).toLowerCase()}`;
    if (await db.tenant.findUnique({ where: { slug } })) {
      slug = `${slug}-${nanoid(4).toLowerCase()}`;
    }

    const email = body.adminEmail.toLowerCase();
    if (await db.tenantUser.findFirst({ where: { email } })) {
      throw new HttpError(409, "A user with that email already exists");
    }

    const embedKey = `fk_${nanoid(24)}`;
    const passwordHash = await hashPassword(body.adminPassword);

    const tenant = await db.tenant.create({
      data: {
        name: body.name,
        slug,
        planTier: body.planTier,
        retainerAmount: body.retainerAmount,
        embedKey,
        embedAllowedOrigins: body.embedAllowedOrigins,
        status: "active",
        subscriptionStatus: "trialing",
        users: {
          create: {
            role: "tenant_admin",
            name: body.adminName,
            email,
            passwordHash,
          },
        },
      },
    });

    const sub = await billing.createSubscription({
      tenantId: tenant.id,
      tenantName: tenant.name,
      planTier: tenant.planTier,
      retainerAmount: Number(tenant.retainerAmount),
    });
    await db.tenant.update({
      where: { id: tenant.id },
      data: { subscriptionStatus: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
    });

    await writeAudit({
      actorId: admin.sub,
      action: "tenant_created",
      targetTenant: tenant.id,
      metadata: { planTier: tenant.planTier, retainerAmount: Number(tenant.retainerAmount) },
    });

    return Response.json({ tenant: { id: tenant.id, slug: tenant.slug, embedKey } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
