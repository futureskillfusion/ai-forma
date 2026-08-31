import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { signCustomerToken } from "@/lib/auth";
import { gateByEmbedKey } from "@/lib/tenant-context";
import { resolvePlanLimit, checkQueryQuota } from "@/lib/plan";

const Body = z.object({
  embedKey: z.string().min(6),
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Consent must be confirmed before starting" }),
  }),
  descriptionText: z.string().max(4000).optional().default(""),
  dimensions: z.string().max(200).optional(),
  materialPreference: z.string().max(200).optional(),
  useCase: z.string().max(500).optional(),
  customerName: z.string().max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await readJson(req, Body);
    const gate = await gateByEmbedKey(body.embedKey);
    if (!gate.ok) {
      throw new HttpError(gate.code === "not_found" ? 404 : 403, gate.message);
    }
    const tenant = gate.tenant;

    // Plan cap enforced server-side before an intake is even created.
    const limit = await resolvePlanLimit(tenant);
    const quota = await checkQueryQuota(tenant, limit);
    if (!quota.allowed && quota.policy === "hard_cutoff") {
      throw new HttpError(429, quota.reason);
    }

    const query = await db.query.create({
      data: {
        tenantId: tenant.id,
        consentConfirmed: true,
        consentConfirmedAt: new Date(),
        descriptionText: body.descriptionText ?? "",
        dimensions: body.dimensions,
        materialPreference: body.materialPreference,
        useCase: body.useCase,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        matchThreshold: 80,
        status: "describing",
      },
    });

    const token = await signCustomerToken({ queryId: query.id, tenantId: tenant.id });
    return Response.json(
      {
        queryId: query.id,
        token,
        quota: { used: quota.used, cap: quota.cap, overage: !quota.allowed },
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
