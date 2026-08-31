import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getTenantUserSession } from "@/lib/auth";

export const metadata = { title: "Tenant sign in" };

export default async function AppLoginPage() {
  if (await getTenantUserSession()) redirect("/app");
  return (
    <div className="flex min-h-full flex-1 flex-col bg-grid">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <Link href="/" className="mx-auto mb-8">
          <Logo />
        </Link>
        <Card className="p-7">
          <h1 className="text-xl font-extrabold tracking-tight">Tenant sign in</h1>
          <p className="mt-1 mb-6 text-sm text-[var(--color-muted-foreground)]">
            For manufacturing business admins and designers.
          </p>
          <LoginForm
            endpoint="/api/app/auth/login"
            redirectTo="/app"
            hint="Demo: owner@3d-2u.com / tenant123"
          />
        </Card>
      </div>
    </div>
  );
}
