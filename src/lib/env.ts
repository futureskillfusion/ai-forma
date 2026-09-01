// Centralised, validated environment access. Import from here, never read
// process.env directly in feature code.
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  USE_MOCK_ADAPTERS: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Image generation provider. "pollinations" = free, no key. "mock" = offline
  // placeholder. Real paid providers can be added in src/lib/adapters/.
  IMAGE_PROVIDER: z.enum(["pollinations", "mock"]).default("pollinations"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — see logs above.");
}

export const env = parsed.data;
