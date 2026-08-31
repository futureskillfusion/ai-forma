import { z } from "zod";
import { readJson } from "@/lib/http";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery, bookForPacket } from "@/lib/intake";
import { db } from "@/lib/db";

const Body = z.object({ slotStart: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;
    const { slotStart } = await readJson(req, Body);

    const owns = await db.handoffPacket.findFirst({ where: { id, queryId: query.id }, select: { id: true } });
    if (!owns) throw new HttpError(404, "Handoff packet not found");

    const appointment = await bookForPacket(id, query.tenantId, slotStart);
    return Response.json({
      appointment: {
        scheduledAt: appointment.scheduledAt,
        durationMinutes: appointment.durationMinutes,
        confidenceTier: appointment.confidenceTier,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
