import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireTenantUser, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";

const Body = z
  .object({
    name: z.string().min(2).max(80).optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .refine((b) => b.name !== undefined || b.password !== undefined, {
    message: "Provide a new name or a new password",
  });

async function loadDesigner(tenantId: string, id: string) {
  const d = await db.tenantUser.findFirst({
    where: { id, tenantId, role: "designer" },
  });
  if (!d) throw new HttpError(404, "Designer not found");
  return d;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await apiRequireTenantUser(["tenant_admin"]);
    const { id } = await params;
    await loadDesigner(s.tenantId, id);
    const body = await readJson(req, Body);

    const designer = await db.tenantUser.update({
      where: { id },
      data: {
        name: body.name ?? undefined,
        passwordHash: body.password ? await hashPassword(body.password) : undefined,
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return Response.json({ designer, passwordChanged: !!body.password });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await apiRequireTenantUser(["tenant_admin"]);
    const { id } = await params;
    await loadDesigner(s.tenantId, id);

    const appts = await db.appointment.count({ where: { designerId: id } });
    if (appts > 0) {
      throw new HttpError(
        409,
        "This designer has booked appointments. Cancel or reassign them before removing the designer.",
      );
    }

    // Handoff packets they were assigned become unassigned (FK is nullable).
    await db.handoffPacket.updateMany({
      where: { assignedDesignerId: id },
      data: { assignedDesignerId: null },
    });
    await db.tenantUser.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
