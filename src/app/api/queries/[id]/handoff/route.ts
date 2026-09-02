import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery, compileHandoff } from "@/lib/intake";
import { booking } from "@/lib/adapters";

const Body = z
  .object({
    // New multi-pick shape
    finalVariationIds: z.array(z.string().uuid()).max(12).optional(),
    // Back-compat single pick
    finalVariationId: z.string().uuid().optional(),
    selfServe: z.boolean().optional(),
    customerNote: z.string().max(4000).optional(),
  })
  .transform((b) => ({
    ...b,
    finalVariationIds:
      b.finalVariationIds ?? (b.finalVariationId ? [b.finalVariationId] : []),
  }));

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");

    const body = await readJson(req, Body);
    if (!body.selfServe && body.finalVariationIds.length === 0) {
      throw new HttpError(400, "Pick at least one concept, or send your own details");
    }

    const { packet, confidenceTier } = await compileHandoff(query, {
      finalVariationIds: body.finalVariationIds,
      selfServe: body.selfServe,
      customerNote: body.customerNote,
    });

    const slots = packet.assignedDesignerId
      ? await booking.getSlots({ designerId: packet.assignedDesignerId, confidenceTier })
      : { slots: [], durationMinutes: 0 };

    return Response.json({
      packet: {
        id: packet.id,
        summaryText: packet.summaryText,
        confidenceTier,
        assignedDesignerId: packet.assignedDesignerId,
        selfServe: query.id ? body.selfServe ?? body.finalVariationIds.length === 0 : false,
      },
      booking: slots,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
