import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createTenantUserSession } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { toErrorResponse } from "@/lib/rbac";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { email, password } = await readJson(req, Body);
    const user = await db.tenantUser.findFirst({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });
    const ok = user && (await verifyPassword(password, user.passwordHash));
    if (!user || !ok) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (user.tenant.status === "suspended") {
      // Suspended tenants can still authenticate but only reach the billing screen.
      await createTenantUserSession(user);
      return Response.json({ ok: true, suspended: true });
    }
    await createTenantUserSession(user);
    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
