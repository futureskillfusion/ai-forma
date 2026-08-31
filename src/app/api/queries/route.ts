import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { signCustomerToken } from "@/lib/auth";
import { gateByEmbedKey } from "@/lib/tenant-context";
import { resolvePlanLimit, checkQueryQuota } from "@/lib/plan";
import { isImageModel, DEFAULT_IMAGE_MODEL, DEFAULT_LLM_MODEL } from "@/lib/models";

const Body = z.object({
  embedKey: z.string().min(6),
  consentConfirmed: z.literal(true, {
    errorMap: () => ({ message: "Consent must be confirmed before starting" }),
  }),
  descriptionText: z.string().max(4000).optional().default(""),
  customerName: z.string().max(120).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().max(40).optional(),
  // Customers pick the image model only. The assistant/LLM used for the
  // feasibility check + brief write-up is a platform default (no chat surface).
  imageModelChoice: z.string().max(60).optional(),
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
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        llmChoice: DEFAULT_LLM_MODEL,
        imageModelChoice: isImageModel(body.imageModelChoice)
          ? body.imageModelChoice
          : DEFAULT_IMAGE_MODEL,
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
