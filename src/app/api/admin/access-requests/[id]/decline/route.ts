import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireSuperAdmin, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { writeAudit } from "@/lib/platform";

const Body = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await apiRequireSuperAdmin();
    const { id } = await params;
    const { reason } = await readJson(req, Body);

    const request = await db.accessRequest.findUnique({ where: { id } });
    if (!request) throw new HttpError(404, "Access request not found");
    if (request.status !== "pending") {
      throw new HttpError(409, `This request is already ${request.status}`);
    }

    await db.accessRequest.update({
      where: { id },
      data: {
        status: "declined",
        declineReason: reason ?? null,
        reviewedByEmail: admin.email,
        reviewedAt: new Date(),
      },
    });

    await writeAudit({
      actorId: admin.sub,
      action: "access_request_declined",
      reason,
      metadata: { businessName: request.businessName, email: request.email },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
