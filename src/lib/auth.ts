import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

// Two fully separate session domains. The super-admin cookie is never accepted
// by tenant surfaces and vice versa — this is the "separate auth flow" the spec
// requires for platform staff.
const ADMIN_COOKIE = "forma_admin_session";
const APP_COOKIE = "forma_app_session";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 hours

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export type SuperAdminSession = {
  kind: "super_admin";
  sub: string;
  email: string;
  name: string;
};

export type TenantUserSession = {
  kind: "tenant_user";
  sub: string;
  email: string;
  name: string;
  role: "tenant_admin" | "designer";
  tenantId: string;
};

type AnySession = SuperAdminSession | TenantUserSession;

async function sign(payload: AnySession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret);
}

async function verify<T extends AnySession>(token: string, kind: T["kind"]): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind !== kind) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

const cookieOpts = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};

export async function createSuperAdminSession(admin: { id: string; email: string; name: string }) {
  const token = await sign({ kind: "super_admin", sub: admin.id, email: admin.email, name: admin.name });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOpts);
}

export async function createTenantUserSession(user: {
  id: string;
  email: string;
  name: string;
  role: "tenant_admin" | "designer";
  tenantId: string;
}) {
  const token = await sign({
    kind: "tenant_user",
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
  });
  (await cookies()).set(APP_COOKIE, token, cookieOpts);
}

export async function getSuperAdminSession(): Promise<SuperAdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  return verify<SuperAdminSession>(token, "super_admin");
}

export async function getTenantUserSession(): Promise<TenantUserSession | null> {
  const token = (await cookies()).get(APP_COOKIE)?.value;
  if (!token) return null;
  return verify<TenantUserSession>(token, "tenant_user");
}

export async function destroySuperAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function destroyTenantUserSession() {
  (await cookies()).delete(APP_COOKIE);
}

// ── Customer (widget) tokens ─────────────────────────────────────────────────
// The intake widget is not "logged in". On query creation we mint a short-lived
// bearer token bound to that one query + tenant; every later widget call must
// present it. This blocks cross-query and cross-tenant enumeration.
export type CustomerToken = { kind: "customer"; queryId: string; tenantId: string };

export async function signCustomerToken(t: Omit<CustomerToken, "kind">): Promise<string> {
  return new SignJWT({ kind: "customer", ...t })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export async function verifyCustomerToken(token: string): Promise<CustomerToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind !== "customer") return null;
    return payload as unknown as CustomerToken;
  } catch {
    return null;
  }
}
