import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSuperAdminSession } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { toErrorResponse } from "@/lib/rbac";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const { email, password } = await readJson(req, Body);
    const admin = await db.superAdmin.findUnique({ where: { email: email.toLowerCase() } });
    const ok = admin && (await verifyPassword(password, admin.passwordHash));
    if (!admin || !ok) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSuperAdminSession(admin);
    return Response.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
