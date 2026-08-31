import { db } from "@/lib/db";
import { toErrorResponse, HttpError } from "@/lib/rbac";
import { requireCustomerQuery } from "@/lib/intake";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const query = await requireCustomerQuery(req);
    const { id } = await params;

    const packet = await db.handoffPacket.findFirst({
      where: { id, queryId: query.id },
      include: {
        finalVariation: true,
        assignedDesigner: { select: { id: true, name: true } },
        appointment: true,
      },
    });
    if (!packet) throw new HttpError(404, "Handoff packet not found");

    return Response.json({
      packet: {
        id: packet.id,
        summaryText: packet.summaryText,
        compiledAt: packet.compiledAt,
        finalImageUrl: packet.finalVariation.imageUrl,
        designer: packet.assignedDesigner,
        appointment: packet.appointment
          ? {
              scheduledAt: packet.appointment.scheduledAt,
              durationMinutes: packet.appointment.durationMinutes,
              confidenceTier: packet.appointment.confidenceTier,
            }
          : null,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
