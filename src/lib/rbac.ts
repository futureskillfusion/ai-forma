import "server-only";
import { redirect } from "next/navigation";
import {
  getSuperAdminSession,
  getTenantUserSession,
  type SuperAdminSession,
  type TenantUserSession,
} from "./auth";

/** For API route handlers — throws a Response on failure. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequireSuperAdmin(): Promise<SuperAdminSession> {
  const s = await getSuperAdminSession();
  if (!s) throw new HttpError(401, "Super admin authentication required");
  return s;
}

export async function apiRequireTenantUser(
  roles?: Array<TenantUserSession["role"]>,
): Promise<TenantUserSession> {
  const s = await getTenantUserSession();
  if (!s) throw new HttpError(401, "Authentication required");
  if (roles && !roles.includes(s.role)) throw new HttpError(403, "Insufficient role");
  return s;
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** For server components / pages — redirects on failure. */
export async function pageRequireSuperAdmin(): Promise<SuperAdminSession> {
  const s = await getSuperAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

export async function pageRequireTenantUser(
  roles?: Array<TenantUserSession["role"]>,
): Promise<TenantUserSession> {
  const s = await getTenantUserSession();
  if (!s) redirect("/app/login");
  if (roles && !roles.includes(s.role)) redirect("/app");
  return s;
}
