import "server-only";
import { nanoid } from "nanoid";
import type { PlanTier } from "@prisma/client";
import { db } from "./db";
import { HttpError } from "./rbac";
import { hashPassword } from "./password";
import { slugify } from "./slug";
import { billing, notify } from "./adapters";

export interface ProvisionInput {
  businessName: string;
  planTier: PlanTier;
  retainerAmount: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  embedAllowedOrigins?: string[];
}

export interface ProvisionResult {
  tenantId: string;
  slug: string;
  embedKey: string;
}

/**
 * Create a tenant account: the org, its first admin user, an embed key, and a
 * subscription via the billing adapter. Shared by manual super-admin creation
 * and the access-request approval flow.
 */
export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  let slug = slugify(input.businessName);
  if (!slug) slug = `tenant-${nanoid(6).toLowerCase()}`;
  if (await db.tenant.findUnique({ where: { slug } })) {
    slug = `${slug}-${nanoid(4).toLowerCase()}`;
  }

  const email = input.adminEmail.toLowerCase();
  if (await db.tenantUser.findFirst({ where: { email } })) {
    throw new HttpError(409, "A user with that email already exists");
  }

  const embedKey = `fk_${nanoid(24)}`;
  const passwordHash = await hashPassword(input.adminPassword);

  const tenant = await db.tenant.create({
    data: {
      name: input.businessName,
      slug,
      planTier: input.planTier,
      retainerAmount: input.retainerAmount,
      embedKey,
      embedAllowedOrigins: input.embedAllowedOrigins ?? [],
      status: "active",
      subscriptionStatus: "trialing",
      users: {
        create: {
          role: "tenant_admin",
          name: input.adminName,
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

  // Welcome / credentials email (mock adapter logs it).
  await notify
    .send({
      channel: "email",
      to: email,
      template: "tenant_welcome",
      data: { businessName: tenant.name, slug, loginUrl: "/app/login" },
    })
    .catch(() => undefined);

  return { tenantId: tenant.id, slug: tenant.slug, embedKey };
}
