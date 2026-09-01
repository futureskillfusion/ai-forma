"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Textarea, Label, FieldHint } from "@/components/ui/field";
import {
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Check,
  CalendarClock,
  ArrowRight,
  Send,
  X,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL, type ModelOption } from "@/lib/models";

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

// Chat transcript on the review step.
type ChatMsg =
  | { id: string; role: "assistant" | "user"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "concepts"; round: number; variationIds: string[] };

let msgSeq = 0;
const nextMsgId = () => `m${++msgSeq}`;

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
  const [imageModelChoice, setImageModelChoice] = useState<string>(DEFAULT_IMAGE_MODEL);

  const [token, setToken] = useState<string | null>(null);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(5);

  // ── review step: chat + bucket ────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [matchPct, setMatchPct] = useState(70);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [roundsExhausted, setRoundsExhausted] = useState(false);
  const [bucketId, setBucketId] = useState<string | null>(null); // the concept the customer picked
  const [dragId, setDragId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const variationById = useCallback(
    (id: string | null) => (id ? variations.find((v) => v.id === id) ?? null : null),
    [variations],
  );
  const latestRoundVariations = useMemo(
    () => variations.filter((v) => v.roundNumber === round),
    [variations, round],
  );
  const bucketVariation = variationById(bucketId);

  const pushMsg = useCallback((m: ChatMsg) => setMessages((prev) => [...prev, m]), []);

  // Auto-scroll the transcript to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, assistantTyping]);

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
      const newVariations: Variation[] = data.variations;
      setRound(data.round);
      setMaxRounds(data.maxRounds);
      setVariations((prev) => [...prev, ...newVariations]);

      if (data.round === 1) {
        pushMsg({
          id: nextMsgId(),
          role: "assistant",
          kind: "text",
          text: `Here are the first concepts for “${form.descriptionText.trim().slice(0, 120)}”. Tell me what to change and I'll try again — or add the one you like to your pick on the right.`,
        });
      } else {
        pushMsg({
          id: nextMsgId(),
          role: "assistant",
          kind: "text",
          text: `Updated concepts — round ${data.round} of ${data.maxRounds}.`,
        });
      }
      pushMsg({
        id: nextMsgId(),
        role: "assistant",
        kind: "concepts",
        round: data.round,
        variationIds: newVariations.map((v) => v.id),
      });
      setStep("review");
    } catch (e) {
      setError((e as Error).message);
      setStep(variations.length ? "review" : "describe");
    } finally {
      setBusy(false);
      setAssistantTyping(false);
    }
  }

  /** Record the customer's feedback on a concept (rating + free text). */
  async function recordFeedback(variationId: string, feedback: string) {
    await api(`/api/variations/${variationId}/ratings`, {
      method: "POST",
      authed: true,
      body: JSON.stringify({
        overallMatchPct: matchPct,
        changeRequestText: feedback || undefined,
        ranking: bucketId ? [bucketId] : [variationId],
      }),
    });
  }

  /** Chat composer submit — send feedback, get a fresh round of concepts. */
  async function sendChat() {
    const text = input.trim();
    if (!text || busy || roundsExhausted) return;
    setError(null);
    setInput("");
    pushMsg({ id: nextMsgId(), role: "user", kind: "text", text });

    const target = bucketId ?? latestRoundVariations[0]?.id ?? null;

    if (round >= maxRounds) {
      setRoundsExhausted(true);
      pushMsg({
        id: nextMsgId(),
        role: "assistant",
        kind: "text",
        text: `That's the last refinement I can run. I've saved everything — add your favourite concept to your pick and I'll send it, with the full conversation, to a ${brandName} designer.`,
      });
      if (target) await recordFeedback(target, text).catch(() => undefined);
      return;
    }

    setBusy(true);
    setAssistantTyping(true);
    try {
      if (target) await recordFeedback(target, text);
      await runGenerate();
    } catch (e) {
      setError((e as Error).message);
      setAssistantTyping(false);
    } finally {
      setBusy(false);
    }
  }

  /** Continue to the handoff step with the concept in the bucket. */
  async function proceedWithBucket() {
    const pick = bucketId ?? latestRoundVariations[0]?.id ?? null;
    if (!pick) {
      setError("Add a concept to your pick first.");
      return;
    }
    setError(null);
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Compiling your brief…");
    try {
      await recordFeedback(pick, "");
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
    <div
      className={cn(
        "glass w-full rounded-2xl border p-6 sm:p-8",
        // The chat + "your pick" review step uses the full widened frame;
        // every other step stays a comfortable single column.
        step === "review" ? "mx-auto max-w-5xl" : "mx-auto max-w-2xl",
      )}
    >
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

          {/* Choose image generation model */}
          <ModelPicker
            id="image-model"
            title="Choose the image generation model"
            hint="Different models have different visual styles. You can't change this mid-session."
            options={IMAGE_MODELS}
            value={imageModelChoice}
            onChange={setImageModelChoice}
          />

          {/* Contact details — last */}
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
        <section className="flex flex-col gap-5 lg:flex-row lg:items-start">
          {/* ── Chat column ─────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between">
              <h1 className="text-lg font-extrabold tracking-tight">Refine your concept</h1>
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                Round {round} / {maxRounds}
              </span>
            </div>

            <div
              ref={scrollRef}
              className="min-h-[300px] flex-1 space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:max-h-[460px]"
            >
              {messages.map((m) =>
                m.kind === "text" ? (
                  <ChatBubble key={m.id} role={m.role} color={primaryColor} brandName={brandName}>
                    {m.text}
                  </ChatBubble>
                ) : (
                  <ChatBubble key={m.id} role="assistant" color={primaryColor} brandName={brandName}>
                    <div className="grid grid-cols-2 gap-2">
                      {m.variationIds.map((id) => {
                        const v = variationById(id);
                        if (!v) return null;
                        return (
                          <ConceptCard
                            key={id}
                            variation={v}
                            color={primaryColor}
                            selected={bucketId === id}
                            draggable
                            onDragStart={() => setDragId(id)}
                            onDragEnd={() => setDragId(null)}
                            action={{
                              label: bucketId === id ? "Added to pick" : "Add to pick",
                              onClick: () => setBucketId(id),
                            }}
                          />
                        );
                      })}
                    </div>
                  </ChatBubble>
                ),
              )}
              {assistantTyping && (
                <ChatBubble role="assistant" color={primaryColor} brandName={brandName}>
                  <span className="inline-flex gap-1">
                    <Dot color={primaryColor} /> <Dot color={primaryColor} delay="0.15s" />{" "}
                    <Dot color={primaryColor} delay="0.3s" />
                  </span>
                </ChatBubble>
              )}
            </div>

            {/* Composer */}
            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2">
              <div className="flex items-center justify-between px-1 pb-1.5">
                <span className="text-xs font-semibold text-[var(--color-foreground)]">
                  How close is your #1 pick?
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: primaryColor }}>
                  {matchPct}%
                </span>
              </div>
              <input
                aria-label="Overall match"
                type="range"
                min={0}
                max={100}
                step={5}
                value={matchPct}
                onChange={(e) => setMatchPct(Number(e.target.value))}
                className="w-full cursor-pointer accent-[var(--brand)]"
              />
              <div className="mt-1.5 flex items-end gap-2">
                <textarea
                  rows={1}
                  value={input}
                  disabled={roundsExhausted}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendChat();
                    }
                  }}
                  placeholder={
                    roundsExhausted
                      ? "Add your favourite concept to your pick, then continue"
                      : "Tell me what to change…"
                  }
                  className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendChat()}
                  disabled={busy || !input.trim() || roundsExhausted}
                  aria-label="Send"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-white transition-opacity disabled:opacity-40 cursor-pointer"
                  style={brand}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Bucket sidebar ──────────────────────────────────────────── */}
          <aside className="shrink-0 lg:w-72">
            <div
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={() => {
                if (dragId) setBucketId(dragId);
                setDragId(null);
              }}
              className={cn(
                "rounded-xl border-2 border-dashed p-3 transition-colors",
                dragId
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                  : "border-[var(--color-border)]",
              )}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Your pick
              </p>

              {bucketVariation ? (
                <div className="mt-2 space-y-2">
                  <div className="overflow-hidden rounded-lg border-2 border-[var(--brand)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bucketVariation.imageUrl}
                      alt="Selected concept"
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                  {bucketVariation.feasibilityFlag && bucketVariation.feasibilityNotes && (
                    <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                      {bucketVariation.feasibilityNotes}
                    </p>
                  )}
                  <Button className="w-full" style={brand} disabled={busy} onClick={proceedWithBucket}>
                    Continue with this <ArrowRight className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setBucketId(null)}
                    className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Choose a different one
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  When a concept matches your idea, <span className="font-semibold">drag it here</span> —
                  or press <span className="font-semibold">“Add to pick”</span> on it — then continue to
                  book a designer with that image.
                </p>
              )}
            </div>
          </aside>
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
  selected = false,
  ...dnd
}: {
  variation: Variation;
  color: string;
  action: { label: string; onClick: () => void };
  selected?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  // Pollinations renders each image on first request (~10s, sometimes rate-
  // limited, sometimes the connection just hangs) and caches after. Retry the
  // same URL several times — on load error AND on a stall timeout — before
  // giving up. A cached URL loads in <1s on retry.
  const MAX_RETRIES = 4;
  const STALL_MS = 12000;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const retry = useCallback(() => {
    setAttempt((a) => {
      if (a >= MAX_RETRIES) {
        setState("error");
        return a;
      }
      setState("loading");
      retryTimer.current = setTimeout(() => {
        if (imgRef.current) imgRef.current.src = variation.imageUrl;
      }, 5000);
      return a + 1;
    });
  }, [variation.imageUrl]);

  // Stall watchdog: if the image hasn't loaded within STALL_MS of (re)start,
  // force a retry rather than waiting on a hung connection.
  useEffect(() => {
    if (state !== "loading") return;
    const t = setTimeout(retry, STALL_MS);
    return () => clearTimeout(t);
  }, [state, attempt, retry]);

  useEffect(() => () => clearTimeout(retryTimer.current), []);

  const handleError = retry;

  return (
    <div
      {...dnd}
      className={cn(
        "group overflow-hidden rounded-lg border-2 bg-[var(--color-card)] transition-colors",
        selected ? "border-[var(--brand)]" : "border-[var(--color-border)]",
      )}
    >
      <div className="relative cursor-grab active:cursor-grabbing">
        {selected && (
          <span
            className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full text-white"
            style={{ background: color }}
          >
            <Check className="h-3 w-3" />
          </span>
        )}
        <div className="relative aspect-square w-full bg-[var(--color-muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={variation.imageUrl}
            alt="Generated concept"
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              state === "ready" ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setState("ready")}
            onError={handleError}
          />
          {state === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border)]"
                style={{ borderTopColor: color }}
                aria-label="Generating concept"
              />
              <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">
                {attempt === 0 ? "Generating…" : "Still generating…"}
              </span>
            </div>
          )}
          {state === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
              <span className="text-[11px] font-medium text-[var(--color-muted-foreground)]">
                This concept didn&apos;t render
              </span>
              <button
                type="button"
                onClick={() => {
                  setAttempt(0);
                  setState("loading");
                  if (imgRef.current) imgRef.current.src = variation.imageUrl;
                }}
                className="rounded-md border border-[var(--color-input)] px-2 py-1 text-[11px] font-semibold hover:bg-[var(--color-muted)] cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}
        </div>
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

function ChatBubble({
  role,
  color,
  brandName,
  children,
}: {
  role: "assistant" | "user";
  color: string;
  brandName: string;
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <span
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
          isUser ? "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]" : "text-white",
        )}
        style={isUser ? undefined : { background: color }}
        aria-hidden="true"
      >
        {isUser ? "You" : brandName.slice(0, 1)}
      </span>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm bg-[var(--color-muted)] text-[var(--color-foreground)]"
            : "rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-background)]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Dot({ color, delay = "0s" }: { color: string; delay?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full"
      style={{ background: color, animationDelay: delay }}
    />
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
  return (
    <div role="radiogroup" aria-labelledby={`${id}-label`}>
      <Label id={`${id}-label`}>{title}</Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.id)}
              className={cn(
                "flex flex-col rounded-lg border-2 px-3 py-2.5 text-left transition-colors cursor-pointer",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                active
                  ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-input)]",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{o.label}</span>
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                    active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--color-input)]",
                  )}
                >
                  {active && <Check className="h-3 w-3" />}
                </span>
              </span>
              <span className="text-[11px] text-[var(--color-muted-foreground)]">{o.vendor}</span>
              <span className="mt-1 text-[11px] leading-snug text-[var(--color-muted-foreground)]">
                {o.blurb}
              </span>
            </button>
          );
        })}
      </div>
      <FieldHint>{hint}</FieldHint>
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

