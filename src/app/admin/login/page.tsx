import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui/card";
import { getSuperAdminSession } from "@/lib/auth";

export const metadata = { title: "Platform admin sign in" };

export default async function AdminLoginPage() {
  if (await getSuperAdminSession()) redirect("/admin");
  return (
    <div className="flex min-h-full flex-1 flex-col bg-grid">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <Link href="/" className="mx-auto mb-8">
          <Logo />
        </Link>
        <Card className="p-7">
          <h1 className="text-xl font-extrabold tracking-tight">Platform admin</h1>
          <p className="mt-1 mb-6 text-sm text-[var(--color-muted-foreground)]">
            Systematic IT Solutions staff only. This is a separate, tighter sign-in from the tenant app.
          </p>
          <LoginForm
            endpoint="/api/admin/auth/login"
            redirectTo="/admin"
            hint="Demo: admin@systematicit.io / superadmin123"
          />
        </Card>
      </div>
    </div>
  );
}
