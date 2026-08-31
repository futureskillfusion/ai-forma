import { destroyTenantUserSession } from "@/lib/auth";

export async function POST() {
  await destroyTenantUserSession();
  return Response.json({ ok: true });
}
