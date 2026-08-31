import { gateByEmbedKey } from "@/lib/tenant-context";
import { isKillSwitchOn } from "@/lib/platform";
import { IntakeWidget } from "@/components/widget/intake-widget";
import { WidgetShell, WidgetUnavailable } from "@/components/widget/widget-chrome";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ embedKey: string }> }) {
  const { embedKey } = await params;
  const gate = await gateByEmbedKey(embedKey);
  return { title: gate.ok ? `${gate.tenant.name} — Design intake` : "Design intake" };
}

export default async function WidgetPage({ params }: { params: Promise<{ embedKey: string }> }) {
  const { embedKey } = await params;
  const gate = await gateByEmbedKey(embedKey);

  if (!gate.ok) {
    return (
      <WidgetShell brandName={gate.tenant?.name ?? "Design intake"} primaryColor={gate.tenant?.primaryColor}>
        <WidgetUnavailable message={gate.message} />
      </WidgetShell>
    );
  }

  const killSwitch = await isKillSwitchOn();

  return (
    <WidgetShell brandName={gate.tenant.name} primaryColor={gate.tenant.primaryColor} logoUrl={gate.tenant.logoUrl}>
      <IntakeWidget
        embedKey={embedKey}
        brandName={gate.tenant.name}
        primaryColor={gate.tenant.primaryColor}
        aiDisabled={killSwitch}
      />
    </WidgetShell>
  );
}
