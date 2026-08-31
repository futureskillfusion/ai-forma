import "server-only";
import type { Tenant } from "@prisma/client";
import { db } from "./db";

export type TenantGate =
  | { ok: true; tenant: Tenant }
  | { ok: false; tenant: Tenant | null; code: "not_found" | "suspended" | "past_due"; message: string };

/**
 * Resolve a tenant from its public embed key and decide whether the customer
 * intake widget should run. Non-active tenants get a clear status, never a
 * silent failure.
 */
export async function gateByEmbedKey(embedKey: string): Promise<TenantGate> {
  const tenant = await db.tenant.findUnique({ where: { embedKey } });
  if (!tenant) {
    return { ok: false, tenant: null, code: "not_found", message: "This intake form is not available." };
  }
  if (tenant.status === "suspended") {
    return {
      ok: false,
      tenant,
      code: "suspended",
      message: "This intake form is temporarily unavailable. Please check back soon.",
    };
  }
  if (tenant.status === "past_due" || tenant.subscriptionStatus === "past_due") {
    return {
      ok: false,
      tenant,
      code: "past_due",
      message: "This intake form is temporarily unavailable. Please check back soon.",
    };
  }
  return { ok: true, tenant };
}

/** Same decision for an already-loaded tenant (used by API writes). */
export function tenantAcceptsIntake(tenant: Pick<Tenant, "status" | "subscriptionStatus">): boolean {
  return (
    tenant.status !== "suspended" &&
    tenant.status !== "past_due" &&
    tenant.subscriptionStatus !== "past_due"
  );
}
