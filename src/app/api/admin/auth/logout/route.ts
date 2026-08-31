import { destroySuperAdminSession } from "@/lib/auth";

export async function POST() {
  await destroySuperAdminSession();
  return Response.json({ ok: true });
}
