"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Textarea } from "@/components/ui/field";
import {
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Check,
  CalendarClock,
  ArrowRight,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";

type Step = "consent" | "describe" | "loading" | "review" | "handoff" | "booked" | "escalated";

interface Variation {
  id: string;
  roundNumber: number;
  imageUrl: string;
  feasibilityFlag: boolean;
  feasibilityNotes: string | null;
}
interface Slot {
  start: string;
  durationMinutes: number;
}

const SHAPE = ["off", "good", "close"] as const;
const SIZE = ["too_big", "good", "too_small"] as const;
const MATERIAL = ["off", "good", "close"] as const;
const SIZE_LABEL: Record<string, string> = { too_big: "Too big", good: "Just right", too_small: "Too small" };
const GEN_LABEL: Record<string, string> = { off: "Off", good: "Good", close: "Close" };

export function IntakeWidget({
  embedKey,
  brandName,
  primaryColor,
  aiDisabled,
}: {
  embedKey: string;
  brandName: string;
  primaryColor: string;
  aiDisabled: boolean;
}) {
  const [step, setStep] = useState<Step>("consent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState("Working…");

  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({
    descriptionText: "",
    dimensions: "",
    materialPreference: "",
    useCase: "",
    customerName: "",
    customerEmail: "",
  });

  const [token, setToken] = useState<string | null>(null);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [rating, setRating] = useState({
    overallMatchPct: 70,
    shapeScore: "good" as (typeof SHAPE)[number],
    sizeScore: "good" as (typeof SIZE)[number],
    materialScore: "good" as (typeof MATERIAL)[number],
    changeRequestText: "",
  });

  const [packet, setPacket] = useState<{ id: string; summaryText: string; confidenceTier: string } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointment, setAppointment] = useState<{ scheduledAt: string; durationMinutes: number } | null>(null);

  const brand = { background: primaryColor };
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const api = useCallback(
    async (path: string, init: RequestInit & { authed?: boolean } = {}) => {
      const headers: Record<string, string> = { "content-type": "application/json", ...(init.headers as object) };
      if (init.authed && token) headers.authorization = `Bearer ${token}`;
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error ?? "Something went wrong") as Error & { payload?: unknown; status?: number };
        err.payload = data;
        err.status = res.status;
        throw err;
      }
      return data;
    },
    [token],
  );

  const currentRoundVariations = useMemo(
    () => variations.filter((v) => v.roundNumber === round),
    [variations, round],
  );

  async function startGeneration() {
    setError(null);
    if (form.descriptionText.trim().length < 8) {
      setError("Please describe your idea in a sentence or two first.");
      return;
    }
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Setting up your session…");
    try {
      const created = await api("/api/queries", {
        method: "POST",
        body: JSON.stringify({
          embedKey,
          consentConfirmed: true,
          descriptionText: form.descriptionText,
          dimensions: form.dimensions || undefined,
          materialPreference: form.materialPreference || undefined,
          useCase: form.useCase || undefined,
          customerName: form.customerName || undefined,
          customerEmail: form.customerEmail || undefined,
        }),
      });
      setToken(created.token);
      setQueryId(created.queryId);
      await runGenerate(created.token, created.queryId);
    } catch (e) {
      setError((e as Error).message);
      setStep("describe");
    } finally {
      setBusy(false);
    }
  }

  async function runGenerate(tok?: string, qid?: string) {
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Generating image variations…");
    const authToken = tok ?? token;
    const targetQueryId = qid ?? queryId;
    try {
      const res = await fetch(`/api/queries/${targetQueryId}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.escalated) {
        setStep("escalated");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setRound(data.round);
      setMaxRounds(data.maxRounds);
      setVariations((prev) => [...prev, ...data.variations]);
      setSelectedId(data.variations[0]?.id ?? null);
      setRating((r) => ({ ...r, changeRequestText: "" }));
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep(variations.length ? "review" : "describe");
    } finally {
      setBusy(false);
    }
  }

  async function submitRating(): Promise<{ canIterate: boolean; meetsThreshold: boolean } | null> {
    if (!selectedId) {
      setError("Select the variation that's closest first.");
      return null;
    }
    const data = await api(`/api/variations/${selectedId}/ratings`, {
      method: "POST",
      authed: true,
      body: JSON.stringify({
        overallMatchPct: rating.overallMatchPct,
        shapeScore: rating.shapeScore,
        sizeScore: rating.sizeScore,
        materialScore: rating.materialScore,
        changeRequestText: rating.changeRequestText || undefined,
      }),
    });
    return { canIterate: data.guidance.canIterate, meetsThreshold: data.guidance.meetsThreshold };
  }

  async function refine() {
    setError(null);
    if (!rating.changeRequestText.trim()) {
      setError("Tell us what to change, then we'll regenerate.");
      return;
    }
    setBusy(true);
    try {
      const g = await submitRating();
      if (!g) return;
      if (!g.canIterate) {
        setStep("escalated");
        return;
      }
      await runGenerate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function proceed() {
    setError(null);
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Compiling your handoff packet…");
    try {
      await submitRating();
      const data = await api(`/api/queries/${queryId}/handoff`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({ finalVariationId: selectedId }),
      });
      setPacket(data.packet);
      setSlots(data.booking.slots ?? []);
      setStep("handoff");
    } catch (e) {
      setError((e as Error).message);
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  async function book(slot: Slot) {
    setBusy(true);
    setError(null);
    try {
      const data = await api(`/api/handoff-packets/${packet!.id}/book`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({ slotStart: slot.start }),
      });
      setAppointment(data.appointment);
      setStep("booked");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="glass rounded-2xl border p-6 sm:p-8">
      <StepDots step={step} />

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-[var(--color-destructive)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {step === "consent" && (
        <section>
          <h1 className="text-xl font-extrabold tracking-tight">Turn your idea into a design brief</h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Describe what you want to make. {brandName} will generate visual concepts you can rate and
            refine, then book you with a designer — no cost to explore.
          </p>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--brand)]"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-4 w-4" /> Confidentiality
              </span>
              <span className="mt-1 block text-[var(--color-muted-foreground)]">
                I understand my description and any generated images are kept confidential and shared
                only with {brandName}'s design team for this request.
              </span>
            </span>
          </label>
          <Button
            className="mt-5 w-full"
            size="lg"
            style={brand}
            disabled={!consent}
            onClick={() => setStep("describe")}
          >
            Agree &amp; continue <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      )}

      {step === "describe" && (
        <section className="space-y-4">
          <h1 className="text-xl font-extrabold tracking-tight">Describe your idea</h1>
          <Fieldset label="What do you want to make?" htmlFor="desc">
            <Textarea
              id="desc"
              rows={4}
              value={form.descriptionText}
              onChange={set("descriptionText")}
              placeholder="A wall-mounted planter shaped like a crescent moon, matte finish, holds one small succulent…"
            />
          </Fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fieldset label="Rough dimensions" htmlFor="dim" hint="Optional">
              <Input id="dim" value={form.dimensions} onChange={set("dimensions")} placeholder="20 x 15 x 8 cm" />
            </Fieldset>
            <Fieldset label="Material preference" htmlFor="mat" hint="Optional">
              <Input id="mat" value={form.materialPreference} onChange={set("materialPreference")} placeholder="Matte PLA, white" />
            </Fieldset>
          </div>
          <Fieldset label="What's it for?" htmlFor="uc" hint="Optional">
            <Input id="uc" value={form.useCase} onChange={set("useCase")} placeholder="Indoor wall decor" />
          </Fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Fieldset label="Your name" htmlFor="cn" hint="Optional">
              <Input id="cn" value={form.customerName} onChange={set("customerName")} />
            </Fieldset>
            <Fieldset label="Email for updates" htmlFor="ce" hint="Optional">
              <Input id="ce" type="email" value={form.customerEmail} onChange={set("customerEmail")} />
            </Fieldset>
          </div>

          {aiDisabled && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Image generation is paused for maintenance right now. Please try again shortly.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("consent")}>Back</Button>
            <Button className="flex-1" size="lg" style={brand} disabled={busy || aiDisabled} onClick={startGeneration}>
              <Sparkles className="h-4 w-4" /> Generate images
            </Button>
          </div>
        </section>
      )}

      {step === "loading" && (
        <section className="py-12 text-center">
          <span
            className="mx-auto block h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--color-muted)]"
            style={{ borderTopColor: primaryColor }}
          />
          <p className="mt-4 text-sm font-semibold text-[var(--color-muted-foreground)]">{loadingLabel}</p>
        </section>
      )}

      {step === "review" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold tracking-tight">Round {round} of up to {maxRounds}</h1>
            <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">Pick the closest</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {currentRoundVariations.map((v) => {
              const selected = selectedId === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedId(v.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border-2 text-left transition-colors",
                    selected ? "border-[var(--brand)]" : "border-[var(--color-border)] hover:border-[var(--color-input)]",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.imageUrl} alt="Generated concept" className="aspect-square w-full object-cover" />
                  {selected && (
                    <span
                      className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-white"
                      style={brand}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  )}
                  {v.feasibilityFlag && (
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-amber-500/90 px-2 py-1 text-[10px] font-semibold text-white">
                      <TriangleAlert className="h-3 w-3" /> Print check
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedId && currentRoundVariations.find((v) => v.id === selectedId)?.feasibilityNotes && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {currentRoundVariations.find((v) => v.id === selectedId)?.feasibilityNotes}
            </p>
          )}

          <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="match" className="text-sm font-semibold">Overall match</label>
                <span className="text-sm font-bold tabular-nums" style={{ color: primaryColor }}>
                  {rating.overallMatchPct}%
                </span>
              </div>
              <input
                id="match"
                type="range"
                min={0}
                max={100}
                step={5}
                value={rating.overallMatchPct}
                onChange={(e) => setRating((r) => ({ ...r, overallMatchPct: Number(e.target.value) }))}
                className="mt-2 w-full cursor-pointer accent-[var(--brand)]"
              />
            </div>

            <SegRow
              label="Shape"
              options={SHAPE.map((v) => ({ v, label: GEN_LABEL[v] }))}
              value={rating.shapeScore}
              onChange={(v) => setRating((r) => ({ ...r, shapeScore: v as (typeof SHAPE)[number] }))}
              color={primaryColor}
            />
            <SegRow
              label="Size"
              options={SIZE.map((v) => ({ v, label: SIZE_LABEL[v] }))}
              value={rating.sizeScore}
              onChange={(v) => setRating((r) => ({ ...r, sizeScore: v as (typeof SIZE)[number] }))}
              color={primaryColor}
            />
            <SegRow
              label="Material"
              options={MATERIAL.map((v) => ({ v, label: GEN_LABEL[v] }))}
              value={rating.materialScore}
              onChange={(v) => setRating((r) => ({ ...r, materialScore: v as (typeof MATERIAL)[number] }))}
              color={primaryColor}
            />

            <Fieldset label="What should change?" htmlFor="cr" hint="Needed to refine — leave blank if it's already right.">
              <Textarea
                id="cr"
                rows={2}
                value={rating.changeRequestText}
                onChange={(e) => setRating((r) => ({ ...r, changeRequestText: e.target.value }))}
                placeholder="Make the base narrower and the curve deeper."
              />
            </Fieldset>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy || round >= maxRounds}
              onClick={refine}
            >
              <Sparkles className="h-4 w-4" />
              {round >= maxRounds ? "No rounds left" : "Refine with changes"}
            </Button>
            <Button className="flex-1" style={brand} disabled={busy} onClick={proceed}>
              This is close enough <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      )}

      {step === "handoff" && packet && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={brand}>
              <Check className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight">Your brief is ready</h1>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Summary for the designer
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{packet.summaryText}</p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Pick an appointment</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  disabled={busy}
                  onClick={() => book(s)}
                  className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:border-[var(--brand)] disabled:opacity-50 cursor-pointer"
                >
                  <CalendarClock className="h-4 w-4 shrink-0" style={{ color: primaryColor }} />
                  <span>
                    {dateTime(s.start)}
                    <span className="block text-xs font-normal text-[var(--color-muted-foreground)]">
                      {s.durationMinutes} min session
                    </span>
                  </span>
                </button>
              ))}
              {slots.length === 0 && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No open times right now — {brandName} will email you to schedule.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {step === "booked" && appointment && (
        <section className="py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white" style={brand}>
            <Check className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">You're booked</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">
            Your session with a {brandName} designer is set for{" "}
            <span className="font-semibold text-[var(--color-foreground)]">{dateTime(appointment.scheduledAt)}</span>{" "}
            ({appointment.durationMinutes} min). Your full brief and chosen concept have been shared with them.
          </p>
        </section>
      )}

      {step === "escalated" && (
        <section className="py-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <TriangleAlert className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight">Let's get a person on this</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">
            You've used the available generation rounds. {brandName}'s team has your idea and every
            round of feedback, and will reach out to continue with you directly.
          </p>
        </section>
      )}
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["consent", "describe", "review", "handoff", "booked"];
  const idx = step === "loading" ? 1 : step === "escalated" ? 3 : order.indexOf(step);
  return (
    <div className="mb-6 flex items-center gap-1.5">
      {order.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            i <= idx ? "bg-[var(--brand)]" : "bg-[var(--color-muted)]",
          )}
        />
      ))}
    </div>
  );
}

function SegRow({
  label,
  options,
  value,
  onChange,
  color,
}: {
  label: string;
  options: { v: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                active ? "text-white" : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)]",
              )}
              style={active ? { background: color, borderColor: color } : undefined}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
