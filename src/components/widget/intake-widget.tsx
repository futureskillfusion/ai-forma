"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Textarea, Select, Label, FieldHint } from "@/components/ui/field";
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
import {
  IMAGE_MODELS,
  LLM_MODELS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LLM_MODEL,
  type ModelOption,
} from "@/lib/models";

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
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });
  const [llmChoice, setLlmChoice] = useState<string>(DEFAULT_LLM_MODEL);
  const [imageModelChoice, setImageModelChoice] = useState<string>(DEFAULT_IMAGE_MODEL);

  const [token, setToken] = useState<string | null>(null);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);

  // Drag-and-drop concept ranking for the current round.
  const [ranking, setRanking] = useState<string[]>([]); // ordered variation ids, top pick first
  const [dragId, setDragId] = useState<string | null>(null);

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
  const pool = useMemo(
    () => currentRoundVariations.filter((v) => !ranking.includes(v.id)),
    [currentRoundVariations, ranking],
  );
  const topPick = ranking[0] ?? null;
  const byId = (id: string) => currentRoundVariations.find((v) => v.id === id);

  // ── ranking helpers ───────────────────────────────────────────────────────
  function addToRanking(id: string, atIndex?: number) {
    setRanking((r) => {
      const without = r.filter((x) => x !== id);
      const idx = atIndex === undefined ? without.length : atIndex;
      return [...without.slice(0, idx), id, ...without.slice(idx)];
    });
  }
  function removeFromRanking(id: string) {
    setRanking((r) => r.filter((x) => x !== id));
  }
  function move(id: string, dir: -1 | 1) {
    setRanking((r) => {
      const i = r.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function onDrop(atIndex?: number) {
    if (dragId) addToRanking(dragId, atIndex);
    setDragId(null);
  }

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
          customerName: form.customerName || undefined,
          customerEmail: form.customerEmail || undefined,
          customerPhone: form.customerPhone || undefined,
          llmChoice,
          imageModelChoice,
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
    setLoadingLabel("Generating concepts…");
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
      setRanking([]); // fresh ranking each round
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
    const pick = topPick ?? currentRoundVariations[0]?.id ?? null;
    if (!pick) {
      setError("Rank at least your top concept first.");
      return null;
    }
    const orderedRanking = ranking.length ? ranking : [pick];
    const data = await api(`/api/variations/${pick}/ratings`, {
      method: "POST",
      authed: true,
      body: JSON.stringify({
        overallMatchPct: rating.overallMatchPct,
        shapeScore: rating.shapeScore,
        sizeScore: rating.sizeScore,
        materialScore: rating.materialScore,
        changeRequestText: rating.changeRequestText || undefined,
        ranking: orderedRanking,
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
    const pick = topPick ?? currentRoundVariations[0]?.id ?? null;
    if (!pick) {
      setError("Rank at least your top concept first.");
      return;
    }
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Compiling your handoff packet…");
    try {
      await submitRating();
      const data = await api(`/api/queries/${queryId}/handoff`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({ finalVariationId: pick }),
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
            Describe what you want to make. {brandName} will generate visual concepts you can rank and
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
        <section className="space-y-6">
          <h1 className="text-xl font-extrabold tracking-tight">Describe your idea</h1>

          <Fieldset label="What do you want to make?" htmlFor="desc">
            <Textarea
              id="desc"
              rows={4}
              value={form.descriptionText}
              onChange={set("descriptionText")}
              placeholder="A wall-mounted planter shaped like a crescent moon, matte white finish, holds one small succulent…"
            />
          </Fieldset>

          {/* Contact details */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-sm font-bold">Contact details</p>
            <p className="mt-0.5 mb-3 text-xs text-[var(--color-muted-foreground)]">
              Optional — so {brandName} can send your concepts and appointment details.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fieldset label="Full name" htmlFor="cn">
                <Input id="cn" value={form.customerName} onChange={set("customerName")} autoComplete="name" />
              </Fieldset>
              <Fieldset label="Email" htmlFor="ce">
                <Input id="ce" type="email" value={form.customerEmail} onChange={set("customerEmail")} autoComplete="email" />
              </Fieldset>
            </div>
            <div className="mt-4">
              <Fieldset label="Phone" htmlFor="cp">
                <Input id="cp" type="tel" value={form.customerPhone} onChange={set("customerPhone")} autoComplete="tel" />
              </Fieldset>
            </div>
          </div>

          {/* Choose your LLM */}
          <ModelPicker
            id="llm-model"
            title="Choose your assistant model"
            hint="It interprets your feedback and writes the brief for the designer."
            options={LLM_MODELS}
            value={llmChoice}
            onChange={setLlmChoice}
          />

          {/* Choose image generation model */}
          <ModelPicker
            id="image-model"
            title="Choose the image generation model"
            hint="You can't change this mid-session."
            options={IMAGE_MODELS}
            value={imageModelChoice}
            onChange={setImageModelChoice}
          />

          {aiDisabled && (
            <p className="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Image generation is paused for maintenance right now. Please try again shortly.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setStep("consent")}>Back</Button>
            <Button className="flex-1" size="lg" style={brand} disabled={busy || aiDisabled} onClick={startGeneration}>
              <Sparkles className="h-4 w-4" /> Generate concepts
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
            <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">Drag to rank</span>
          </div>

          <p className="text-sm text-[var(--color-muted-foreground)]">
            Drag the concepts into the ranking box in order of preference — your{" "}
            <span className="font-semibold text-[var(--color-foreground)]">#1</span> is the one we refine or send to the designer.
          </p>

          {/* Concept pool */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Concepts {pool.length > 0 ? `(${pool.length} unranked)` : "(all ranked)"}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {pool.map((v) => (
                <ConceptCard
                  key={v.id}
                  variation={v}
                  color={primaryColor}
                  draggable
                  onDragStart={() => setDragId(v.id)}
                  onDragEnd={() => setDragId(null)}
                  action={{ label: "Add to ranking", onClick: () => addToRanking(v.id) }}
                />
              ))}
              {pool.length === 0 && (
                <p className="col-span-full rounded-md border border-dashed border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted-foreground)]">
                  Every concept is in your ranking below.
                </p>
              )}
            </div>
          </div>

          {/* Ranking bucket */}
          <div
            onDragOver={(e) => {
              if (dragId) e.preventDefault();
            }}
            onDrop={() => onDrop()}
            className={cn(
              "rounded-lg border-2 border-dashed p-3 transition-colors",
              dragId ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]" : "border-[var(--color-border)]",
            )}
          >
            <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Your ranking
              {ranking.length === 0 && <span className="font-medium normal-case">— drag concepts here</span>}
            </p>
            <ol className="space-y-2">
              {ranking.map((id, i) => {
                const v = byId(id);
                if (!v) return null;
                return (
                  <li
                    key={id}
                    draggable
                    onDragStart={() => setDragId(id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => {
                      if (dragId && dragId !== id) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      onDrop(i);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-md border bg-[var(--color-card)] p-2",
                      i === 0 ? "border-[var(--brand)]" : "border-[var(--color-border)]",
                    )}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white"
                      style={brand}
                    >
                      {i + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      Concept {currentRoundVariations.indexOf(v) + 1}
                      {i === 0 && <span className="ml-1 text-xs font-bold" style={{ color: primaryColor }}>· top pick</span>}
                      {v.feasibilityFlag && (
                        <span className="block text-xs font-medium text-[var(--color-warning)]">Print check flagged</span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <IconBtn label="Move up" disabled={i === 0} onClick={() => move(id, -1)}>↑</IconBtn>
                      <IconBtn label="Move down" disabled={i === ranking.length - 1} onClick={() => move(id, 1)}>↓</IconBtn>
                      <IconBtn label="Remove from ranking" onClick={() => removeFromRanking(id)}>✕</IconBtn>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>

          {topPick && byId(topPick)?.feasibilityNotes && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {byId(topPick)?.feasibilityNotes}
            </p>
          )}

          {/* Rating of the top pick */}
          <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="text-sm font-bold">
              How close is your #1 pick{topPick ? ` (Concept ${currentRoundVariations.indexOf(byId(topPick)!) + 1})` : ""}?
            </p>
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
            ({appointment.durationMinutes} min). Your full brief and ranked concepts have been shared with them.
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

// ── sub-components ──────────────────────────────────────────────────────────

function ConceptCard({
  variation,
  color,
  action,
  ...dnd
}: {
  variation: Variation;
  color: string;
  action: { label: string; onClick: () => void };
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...dnd}
      className="group overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <div className="relative cursor-grab active:cursor-grabbing">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={variation.imageUrl} alt="Generated concept" className="aspect-square w-full object-cover" />
        {variation.feasibilityFlag && (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-amber-500/90 px-2 py-1 text-[10px] font-semibold text-white">
            <TriangleAlert className="h-3 w-3" /> Print check
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={action.onClick}
        className="w-full border-t border-[var(--color-border)] px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-muted)] cursor-pointer"
        style={{ color }}
      >
        {action.label}
      </button>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded border border-[var(--color-border)] bg-[var(--color-card)] text-xs transition-colors hover:bg-[var(--color-muted)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function ModelPicker({
  title,
  hint,
  options,
  value,
  onChange,
  id,
}: {
  title: string;
  hint: string;
  options: ModelOption[];
  value: string;
  onChange: (id: string) => void;
  id: string;
}) {
  const selected = options.find((o) => o.id === value);
  return (
    <div>
      <Label htmlFor={id}>{title}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label} — {o.vendor}
          </option>
        ))}
      </Select>
      <FieldHint>{selected ? `${selected.blurb}. ${hint}` : hint}</FieldHint>
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
