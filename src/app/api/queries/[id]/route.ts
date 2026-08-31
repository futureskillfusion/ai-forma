import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";

const Body = z.object({
  descriptionText: z.string().max(4000).optional(),
  dimensions: z.string().max(200).nullish(),
  materialPreference: z.string().max(200).nullish(),
  useCase: z.string().max(500).nullish(),
  customerName: z.string().max(120).nullish(),
  customerEmail: z.string().email().nullish(),
  customerPhone: z.string().max(40).nullish(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");
    if (query.status !== "describing" && query.status !== "rating") {
      throw new HttpError(409, "This query can no longer be edited");
    }

    const body = await readJson(req, Body);
    const updated = await db.query.update({
      where: { id: query.id },
      data: {
        descriptionText: body.descriptionText ?? undefined,
        dimensions: body.dimensions ?? undefined,
        materialPreference: body.materialPreference ?? undefined,
        useCase: body.useCase ?? undefined,
        customerName: body.customerName ?? undefined,
        customerEmail: body.customerEmail ?? undefined,
        customerPhone: body.customerPhone ?? undefined,
      },
    });
    return Response.json({
      query: {
        id: updated.id,
        descriptionText: updated.descriptionText,
        dimensions: updated.dimensions,
        materialPreference: updated.materialPreference,
        useCase: updated.useCase,
        status: updated.status,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
