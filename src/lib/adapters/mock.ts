import { addBusinessDays, setHours, setMinutes } from "date-fns";
import type {
  BillingAdapter,
  BookingAdapter,
  ImageGenAdapter,
  LlmAdapter,
  NotifyAdapter,
  TranscriptionAdapter,
} from "./types";

// ── deterministic helpers ────────────────────────────────────────────────────
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTE = [
  ["#2563EB", "#DBEAFE"],
  ["#EA580C", "#FFEDD5"],
  ["#059669", "#D1FAE5"],
  ["#7C3AED", "#EDE9FE"],
  ["#DB2777", "#FCE7F3"],
];

/** Offline SVG placeholder — no external image host, CSP-safe. */
function placeholderImage(seed: string, label: string, model: string, variant: number): string {
  const [fg, bg] = PALETTE[hash(seed + model + variant) % PALETTE.length];
  const clean = label.replace(/[<>&]/g, "").slice(0, 38);
  const modelClean = model.replace(/[<>&]/g, "").slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
  <rect width="640" height="640" fill="${bg}"/>
  <circle cx="320" cy="296" r="${120 + variant * 24}" fill="${fg}" opacity="0.9"/>
  <rect x="140" y="${176 + variant * 10}" width="360" height="${240 - variant * 8}" rx="28" fill="${fg}" opacity="0.35"/>
  <text x="320" y="556" font-family="Plus Jakarta Sans, sans-serif" font-size="26" font-weight="700" fill="${fg}" text-anchor="middle">Concept ${variant + 1}</text>
  <text x="320" y="588" font-family="Plus Jakarta Sans, sans-serif" font-size="14" fill="${fg}" opacity="0.7" text-anchor="middle">${clean}</text>
  <text x="320" y="612" font-family="Plus Jakarta Sans, sans-serif" font-size="12" fill="${fg}" opacity="0.55" text-anchor="middle">${modelClean}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const mockImageGen: ImageGenAdapter = {
  async generate({ prompt, count, seed, model }) {
    const chosen = model ?? "flux-pro";
    const base = seed ?? prompt;
    const label = prompt.split(",")[0] ?? prompt;
    const images = Array.from({ length: count }, (_, i) => ({
      url: placeholderImage(base, label, chosen, i),
      prompt: `[${chosen}] ${prompt} — rendering pass ${i + 1}`,
    }));
    return { images, units: count };
  },
};

export const mockTranscription: TranscriptionAdapter = {
  async transcribe({ audioUrl }) {
    const minutes = 0.5 + (hash(audioUrl) % 180) / 60; // 0.5–3.5 min
    return {
      text:
        "I'd like a wall-mounted planter shaped like a crescent moon with a matte finish. " +
        "It should hold a small succulent and mount with two hidden screws.",
      minutes: +minutes.toFixed(2),
    };
  },
};

export const mockLlm: LlmAdapter = {
  async feasibilityCheck({ description }) {
    const risky = /thin|0\.?\d?mm|hollow|overhang|bridge|tall and narrow/i.test(description);
    return {
      flagged: risky,
      notes: risky
        ? "Design may have thin unsupported walls or steep overhangs that need supports or a wall-thickness increase before printing."
        : null,
      tokens: 420,
    };
  },

  async compileHandoff({
    description,
    contact,
    rounds,
    finalMatchPct,
    picks,
    customerNote,
    attachmentCount,
    selfServe,
  }) {
    const iterations = rounds.length;
    const changes = rounds
      .map((r) => (r.changeRequest ? `• Round ${r.round}: ${r.changeRequest}` : null))
      .filter(Boolean)
      .join("\n");
    const contactLine = contact
      ? [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ")
      : "";

    const picksLine =
      picks && picks.length
        ? `Customer picked ${picks.length} concept${picks.length === 1 ? "" : "s"}: ` +
          picks.map((p, i) => `#${i + 1} at ${p.matchPct}% match`).join(", ") + "."
        : null;

    const summaryText = [
      `Customer wants: ${description}`,
      contactLine ? `Contact: ${contactLine}` : null,
      attachmentCount ? `${attachmentCount} reference file(s) / sketch(es) attached.` : null,
      selfServe
        ? "The customer did not find an AI concept close enough and is sending their own details for the designer to work from."
        : picksLine,
      customerNote ? `\nCustomer's note to the designer:\n“${customerNote}”` : null,
      "",
      selfServe
        ? "Start from the customer's attachments and note above."
        : `The concept was refined over ${iterations} generation round${iterations === 1 ? "" : "s"}, ` +
          `ending at a ${finalMatchPct}% self-reported match on the lead pick. Key change requests:`,
      selfServe ? null : changes || "• (no free-text change requests recorded)",
      "",
      finalMatchPct >= 85 && !selfServe
        ? "The brief is tight — a short confirmation session should be enough to move to modelling."
        : "Some ambiguity remains — allow time to confirm proportions and details with the customer.",
    ]
      .filter((l) => l !== null)
      .join("\n");
    return { summaryText, tokens: 900 + iterations * 120 };
  },
};

export const mockBilling: BillingAdapter = {
  async createSubscription({ tenantId }) {
    const now = new Date();
    return {
      subscriptionId: `sub_mock_${tenantId.slice(0, 8)}`,
      status: "active",
      currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
    };
  },
  async cancelSubscription() {
    return { status: "canceled" };
  },
};

export const mockBooking: BookingAdapter = {
  async getSlots({ confidenceTier }) {
    const durationMinutes =
      confidenceTier === "high" ? 20 : confidenceTier === "standard" ? 40 : 60;
    const slots = [1, 2, 3, 4].map((d) => {
      const day = addBusinessDays(new Date(), d);
      return {
        start: setMinutes(setHours(day, 10 + (d % 3) * 2), 0).toISOString(),
        durationMinutes,
      };
    });
    return { slots, durationMinutes };
  },
  async book({ start }) {
    return { externalCalendarEventId: `evt_mock_${hash(start).toString(16)}` };
  },
};

export const mockNotify: NotifyAdapter = {
  async send({ channel, to }) {
    return { id: `${channel}_mock_${hash(to).toString(16)}` };
  },
};
