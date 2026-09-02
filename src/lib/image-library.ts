import { env } from "./env";

/**
 * Curated product-photo library. When the customer's description matches an
 * entry's keywords, the widget shows THESE images as the concepts instead of
 * generating from scratch — useful for an existing product line where real
 * photos beat AI guesses.
 *
 * Add more entries as the catalogue grows. Files live in `public/library/`.
 */
export interface LibraryEntry {
  id: string;
  keywords: string[]; // matched case-insensitively as whole words / substrings
  label: string;
  images: string[]; // paths under /public
}

export const IMAGE_LIBRARY: LibraryEntry[] = [
  {
    id: "grip",
    label: "Grip",
    keywords: ["grip", "grips", "handle", "handgrip", "hand grip", "pistol grip", "tap grip"],
    images: [
      "/library/grip-white.png",
      "/library/grip-gold.png",
      "/library/grip-red.png",
      "/library/grip-standard.png",
      "/library/grip-alt.png",
    ],
  },
];

/** Return the library entry whose keywords appear in the text, or null. */
export function matchLibrary(text: string): LibraryEntry | null {
  const hay = ` ${text.toLowerCase()} `;
  for (const entry of IMAGE_LIBRARY) {
    if (entry.keywords.some((k) => hay.includes(` ${k} `) || hay.includes(k))) {
      return entry;
    }
  }
  return null;
}

/** Absolute URLs for the images to show on a given round (cycles through the set). */
export function libraryRoundImages(entry: LibraryEntry, round: number, count = 2): string[] {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const start = ((round - 1) * count) % entry.images.length;
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(base + entry.images[(start + i) % entry.images.length]);
  }
  return picked;
}
