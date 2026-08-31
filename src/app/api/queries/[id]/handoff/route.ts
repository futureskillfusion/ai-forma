import { z } from "zod";
import { db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery, compileHandoff } from "@/lib/intake";
import { booking } from "@/lib/adapters";

const Body = z.object({ finalVariationId: z.string().uuid() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    if (id !== query.id) throw new HttpError(403, "Token does not match this query");

    const { finalVariationId } = await readJson(req, Body);
    const { packet, confidenceTier } = await compileHandoff(query, finalVariationId);

    const slots = packet.assignedDesignerId
      ? await booking.getSlots({ designerId: packet.assignedDesignerId, confidenceTier })
      : { slots: [], durationMinutes: 0 };

    return Response.json({
      packet: {
        id: packet.id,
        summaryText: packet.summaryText,
        confidenceTier,
        assignedDesignerId: packet.assignedDesignerId,
      },
      booking: slots,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
