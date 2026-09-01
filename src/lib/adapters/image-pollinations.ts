import type { ImageGenAdapter } from "./types";

// Free, key-less image generation via Pollinations (https://pollinations.ai).
// Anonymous use is slow-ish (~10s) and bursty, so we DON'T fetch server-side
// (that just blocks the request and times out). We return "turbo" (SDXL) URLs
// and let the browser load them with retry-on-error (see the widget's
// ConceptCard). One non-blocking warm-up nudges Pollinations to start rendering.
// The customer's chosen model *label* is preserved on the brief; wire a paid
// provider here to honour the actual model choice.
const MODEL = "turbo";
const REFERRER = "aiforma.app";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function buildUrl(prompt: string, seed: number): string {
  const p = encodeURIComponent(prompt.slice(0, 380));
  const params = new URLSearchParams({
    width: "640",
    height: "640",
    seed: String(seed),
    model: MODEL,
    nologo: "true",
    nofeed: "true",
    referrer: REFERRER,
  });
  return `https://image.pollinations.ai/prompt/${p}?${params.toString()}`;
}

export const pollinationsImageGen: ImageGenAdapter = {
  async generate(input) {
    // Two concepts keeps the browser's rate-limited loads manageable.
    const count = Math.min(input.count, 2);
    const seedBase = hash(input.seed ?? input.prompt);

    const images = Array.from({ length: count }, (_, i) => {
      const seed = (seedBase + i * 7919) % 2_000_000;
      return {
        url: buildUrl(input.prompt, seed),
        prompt: `${input.prompt} — concept ${i + 1}`,
      };
    });

    // Non-blocking warm-up: kick Pollinations to start rendering, staggered so
    // we don't trip its burst limit. Never awaited — the browser does the real
    // load with retries.
    images.forEach((img, i) => {
      setTimeout(() => {
        fetch(img.url).catch(() => undefined);
      }, i * 2500);
    });

    return { images, units: count };
  },
};
