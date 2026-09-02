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
  Paperclip,
  Pencil,
} from "@/components/icons";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL, type ModelOption } from "@/lib/models";
import { DrawingCanvas } from "./drawing-canvas";

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
interface Attachment {
  id: string;
  url: string;
  kind: "reference" | "drawing" | "self_serve";
  mimeType: string;
  label?: string | null;
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

  // ── review step: chat + picks ─────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [matchPct, setMatchPct] = useState(70);
  const [assistantTyping, setAssistantTyping] = useState(false);
  const [roundsExhausted, setRoundsExhausted] = useState(false);
  // Multiple picks, each capturing the match % set when it was added.
  const [picks, setPicks] = useState<{ id: string; matchPct: number }[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [designerNote, setDesignerNote] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showDrawing, setShowDrawing] = useState(false);
  const [selfServeOpen, setSelfServeOpen] = useState(false);
  const [selfServeText, setSelfServeText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const isPicked = (id: string) => picks.some((p) => p.id === id);
  const togglePick = (id: string) =>
    setPicks((cur) =>
      cur.some((p) => p.id === id)
        ? cur.filter((p) => p.id !== id)
        : [...cur, { id, matchPct }],
    );
  const removePick = (id: string) => setPicks((cur) => cur.filter((p) => p.id !== id));

  const pushMsg = useCallback((m: ChatMsg) => setMessages((prev) => [...prev, m]), []);

  // ── attachments (reference uploads + sketches) ────────────────────────────
  async function uploadDataUrl(dataUrl: string, kind: Attachment["kind"], label?: string) {
    if (!queryId) return;
    const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/png";
    try {
      const res = await api(`/api/queries/${queryId}/attachments`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({ kind, dataUrl, mimeType, label }),
      });
      setAttachments((a) => [...a, res.attachment]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function onFilesPicked(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 6)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2_600_000) {
        setError("Each reference image must be under 2.5 MB.");
        continue;
      }
      const dataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(file);
      });
      await uploadDataUrl(dataUrl, "reference", file.name);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  async function removeAttachment(id: string) {
    setAttachments((a) => a.filter((x) => x.id !== id));
    if (queryId)
      await fetch(`/api/queries/${queryId}/attachments?attachmentId=${id}`, {
        method: "DELETE",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      }).catch(() => undefined);
  }

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
  async function recordFeedback(variationId: string, feedback: string, pct = matchPct) {
    await api(`/api/variations/${variationId}/ratings`, {
      method: "POST",
      authed: true,
      body: JSON.stringify({
        overallMatchPct: pct,
        changeRequestText: feedback || undefined,
        ranking: [variationId],
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

    const target = picks[0]?.id ?? latestRoundVariations[0]?.id ?? null;

    if (round >= maxRounds) {
      setRoundsExhausted(true);
      pushMsg({
        id: nextMsgId(),
        role: "assistant",
        kind: "text",
        text: `That's the last refinement I can run. Add the concepts you like to your picks on the right — or send your own details — and I'll hand it to a ${brandName} designer with the full conversation.`,
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

  /** Continue to the handoff step with the picked concept(s). */
  async function proceedWithPicks() {
    if (picks.length === 0) {
      setError("Add at least one concept to your picks.");
      return;
    }
    setError(null);
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Compiling your brief…");
    try {
      for (const p of picks) await recordFeedback(p.id, "", p.matchPct);
      const data = await api(`/api/queries/${queryId}/handoff`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({
          finalVariationIds: picks.map((p) => p.id),
          customerNote: designerNote.trim() || undefined,
        }),
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

  /** Skip the AI concepts — send the customer's own details + files. */
  async function proceedSelfServe() {
    const note = [selfServeText.trim(), designerNote.trim()].filter(Boolean).join("\n\n");
    if (!note && attachments.length === 0) {
      setError("Add a message or upload a file so the designer has something to work from.");
      return;
    }
    setError(null);
    setBusy(true);
    setStep("loading");
    setLoadingLabel("Sending your details…");
    try {
      const data = await api(`/api/queries/${queryId}/handoff`, {
        method: "POST",
        authed: true,
        body: JSON.stringify({ selfServe: true, customerNote: note || undefined }),
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
                  <ChatBubble key={m.id} role="assistant" color={primaryColor} brandName={brandName} wide>
                    <div className="grid grid-cols-2 gap-3">
                      {m.variationIds.map((id) => {
                        const v = variationById(id);
                        if (!v) return null;
                        return (
                          <ConceptCard
                            key={id}
                            variation={v}
                            color={primaryColor}
                            draggable
                            onDragStart={() => setDragId(id)}
                            onDragEnd={() => setDragId(null)}
                            onPick={() => togglePick(id)}
                            picked={isPicked(id)}
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

            {showDrawing && (
              <div className="mt-3">
                <DrawingCanvas
                  brandColor={primaryColor}
                  onCancel={() => setShowDrawing(false)}
                  onSave={async (dataUrl) => {
                    await uploadDataUrl(dataUrl, "drawing", "Sketch");
                    setShowDrawing(false);
                  }}
                />
              </div>
            )}

            {/* Attachment strip */}
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span key={a.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.url}
                      alt={a.label ?? a.kind}
                      className="h-14 w-14 rounded-md border border-[var(--color-border)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void removeAttachment(a.id)}
                      aria-label="Remove attachment"
                      className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-foreground)] text-white cursor-pointer"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                    <span className="absolute inset-x-0 bottom-0 truncate rounded-b-md bg-black/50 px-1 text-[8px] text-white">
                      {a.kind === "drawing" ? "sketch" : "reference"}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Composer */}
            <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2">
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => void onFilesPicked(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={roundsExhausted}
                  aria-label="Attach a reference image"
                  title="Attach a reference image"
                  className="grid h-10 w-9 shrink-0 place-items-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-40 cursor-pointer"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDrawing((s) => !s)}
                  disabled={roundsExhausted}
                  aria-label="Draw a sketch"
                  title="Draw a sketch"
                  className={cn(
                    "grid h-10 w-9 shrink-0 place-items-center rounded-md hover:bg-[var(--color-muted)] disabled:opacity-40 cursor-pointer",
                    showDrawing ? "text-[var(--brand)]" : "text-[var(--color-muted-foreground)]",
                  )}
                >
                  <Pencil className="h-4 w-4" />
                </button>
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
                    roundsExhausted ? "Rounds used — add picks or send your own details" : "Tell me what to change… (attach a reference if you have one)"
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

          {/* ── Picks sidebar ───────────────────────────────────────────── */}
          <aside className="shrink-0 space-y-3 lg:w-80">
            <div
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={() => {
                if (dragId) togglePick(dragId);
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
                Your picks{picks.length > 0 ? ` (${picks.length})` : ""}
              </p>

              {picks.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {picks.map((p, i) => {
                    const v = variationById(p.id);
                    if (!v) return null;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-1.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={v.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                        <span className="min-w-0 flex-1 text-xs">
                          <span className="font-semibold">Pick {i + 1}</span>
                          <span className="block text-[var(--color-muted-foreground)]">{p.matchPct}% match</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removePick(p.id)}
                          aria-label="Remove pick"
                          className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <label className="block pt-1 text-xs font-semibold">
                    Add a note for the designer (optional)
                    <textarea
                      rows={2}
                      value={designerNote}
                      onChange={(e) => setDesignerNote(e.target.value)}
                      placeholder="e.g. I like #1's shape but #2's colour."
                      className="mt-1 w-full resize-none rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-2 py-1.5 text-xs font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                    />
                  </label>

                  <Button className="w-full" style={brand} disabled={busy} onClick={proceedWithPicks}>
                    Continue with {picks.length} pick{picks.length === 1 ? "" : "s"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  Click a concept (or drag it here) to add it to your picks. You can add more than one and
                  note what you like about each.
                </p>
              )}

              {/* Match slider — captured when you add the next pick */}
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">How close is it?</span>
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
                  className="mt-1.5 w-full cursor-pointer accent-[var(--brand)]"
                />
                <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">
                  Set this, then add a concept — it's saved with that pick.
                </p>
              </div>
            </div>

            {/* Self-serve fallback */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              {!selfServeOpen ? (
                <button
                  type="button"
                  onClick={() => setSelfServeOpen(true)}
                  className="w-full text-left text-xs font-semibold text-[var(--color-foreground)] hover:underline cursor-pointer"
                >
                  Not quite right? Send your own details instead →
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                    Send your own details
                  </p>
                  <textarea
                    rows={3}
                    value={selfServeText}
                    onChange={(e) => setSelfServeText(e.target.value)}
                    placeholder="Describe exactly what you need — measurements, materials, references, anything the designer should know."
                    className="w-full resize-none rounded-md border border-[var(--color-input)] bg-[var(--color-card)] px-2 py-1.5 text-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--color-input)] px-2 py-2 text-xs font-semibold text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] cursor-pointer"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> Upload your files
                    {attachments.length > 0 ? ` (${attachments.length})` : ""}
                  </button>
                  <Button className="w-full" style={brand} disabled={busy} onClick={proceedSelfServe}>
                    Send to a designer <ArrowRight className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSelfServeOpen(false)}
                    className="w-full text-center text-[10px] text-[var(--color-muted-foreground)] hover:underline cursor-pointer"
                  >
                    Keep refining with AI
                  </button>
                </div>
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
  onPick,
  picked = false,
  ...dnd
}: {
  variation: Variation;
  color: string;
  onPick: () => void;
  picked?: boolean;
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
        picked ? "border-[var(--brand)]" : "border-[var(--color-border)]",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick();
          }
        }}
        aria-pressed={picked}
        aria-label={picked ? "Remove this concept from your pick" : "Add this concept to your pick"}
        className="relative cursor-pointer active:cursor-grabbing"
      >
        {picked && (
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
                onClick={(e) => {
                  e.stopPropagation();
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
        onClick={onPick}
        className={cn(
          "flex w-full items-center justify-center gap-1 border-t border-[var(--color-border)] px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-muted)] cursor-pointer",
        )}
        style={{ color }}
      >
        {picked ? (
          <>
            <X className="h-3 w-3" /> Remove from pick
          </>
        ) : (
          "Add to pick"
        )}
      </button>
    </div>
  );
}

function ChatBubble({
  role,
  color,
  brandName,
  children,
  wide = false,
}: {
  role: "assistant" | "user";
  color: string;
  brandName: string;
  children: React.ReactNode;
  wide?: boolean;
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
          "min-w-0 rounded-2xl text-sm leading-relaxed",
          // Concept grids span the full chat width so every image is the same
          // size; text bubbles stay chat-width-limited.
          wide ? "flex-1" : "max-w-[85%] px-3 py-2",
          isUser
            ? "rounded-tr-sm bg-[var(--color-muted)] text-[var(--color-foreground)]"
            : wide
              ? ""
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

