import { z } from "zod";
import { db } from "@/lib/db";
import { apiRequireTenantUser, toErrorResponse, HttpError } from "@/lib/rbac";
import { readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { resolvePlanLimit } from "@/lib/plan";

export async function GET() {
  try {
    const s = await apiRequireTenantUser();
    const designers = await db.tenantUser.findMany({
      where: { tenantId: s.tenantId, role: "designer" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, calendarConnectionId: true, createdAt: true },
    });
    return Response.json({ designers });
  } catch (err) {
    return toErrorResponse(err);
  }
}

const Body = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const s = await apiRequireTenantUser(["tenant_admin"]);
    const body = await readJson(req, Body);

    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: s.tenantId } });
    const limit = await resolvePlanLimit(tenant);
    const seatsUsed = await db.tenantUser.count({
      where: { tenantId: s.tenantId, role: "designer" },
    });
    if (seatsUsed >= limit.designerSeats) {
      throw new HttpError(409, `Plan allows ${limit.designerSeats} designer seat(s). Upgrade to add more.`);
    }

    const email = body.email.toLowerCase();
    if (await db.tenantUser.findFirst({ where: { tenantId: s.tenantId, email } })) {
      throw new HttpError(409, "A user with that email already exists in your team");
    }

    const designer = await db.tenantUser.create({
      data: {
        tenantId: s.tenantId,
        role: "designer",
        name: body.name,
        email,
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return Response.json({ designer }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
