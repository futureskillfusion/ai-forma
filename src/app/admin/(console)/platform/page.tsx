import { PageHeader } from "@/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platform";
import { ADAPTER_MODE, IMAGE_PROVIDER } from "@/lib/adapters";
import { dateTime } from "@/lib/format";
import { KillSwitch } from "./kill-switch";

export const metadata = { title: "Platform controls" };
export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const cfg = await getPlatformConfig();
  const audit = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Platform controls"
        description="Switches and audit trail that span every tenant."
      />

      <div className="space-y-6">
        <KillSwitch initialEnabled={cfg.killSwitchEnabled} />

        <Card>
          <CardHeader>
            <CardTitle>Vendor integration mode</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Non-image adapters are running in{" "}
              <span className="font-bold uppercase">{ADAPTER_MODE}</span> mode.
              {ADAPTER_MODE === "mock"
                ? " Voice, LLM, billing, booking and notification calls are simulated with deterministic fake data — no external API keys required."
                : " Real vendor credentials are in use."}
            </p>
            <p className="mt-2 text-sm">
              Image generation: <span className="font-bold uppercase">{IMAGE_PROVIDER}</span>
              {IMAGE_PROVIDER === "pollinations"
                ? " — free, key-less real image generation (Pollinations). No per-image cost is logged."
                : " — offline placeholder images."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {audit.length === 0 && <p className="text-sm text-[var(--color-muted-foreground)]">Nothing logged yet.</p>}
            {audit.map((a) => (
              <div key={a.id} className="flex flex-col gap-0.5 border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-semibold capitalize">{a.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {a.actor.name} · {dateTime(a.createdAt)}
                  {a.targetTenant ? ` · tenant ${a.targetTenant.slice(0, 8)}` : ""}
                  {a.reason ? ` · ${a.reason}` : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
