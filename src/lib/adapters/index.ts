import { env } from "../env";
import {
  mockBilling,
  mockBooking,
  mockImageGen,
  mockLlm,
  mockNotify,
  mockTranscription,
} from "./mock";
import { pollinationsImageGen } from "./image-pollinations";
import type {
  BillingAdapter,
  BookingAdapter,
  ImageGenAdapter,
  LlmAdapter,
  NotifyAdapter,
  TranscriptionAdapter,
} from "./types";

// Non-image vendors: mock unless USE_MOCK_ADAPTERS=false (then they throw a
// clear "not configured" error until real implementations are added).
function notConfigured(name: string): never {
  throw new Error(
    `Real "${name}" adapter is not configured. Set USE_MOCK_ADAPTERS=true or implement it in src/lib/adapters/.`,
  );
}

const realStub = new Proxy(
  {},
  { get: (_t, prop) => () => notConfigured(String(prop)) },
) as never;

const useMock = env.USE_MOCK_ADAPTERS;

// Image generation has its own switch so real images work while everything
// else stays mocked. "pollinations" is free and needs no API key.
export const imageGen: ImageGenAdapter =
  env.IMAGE_PROVIDER === "pollinations" ? pollinationsImageGen : mockImageGen;

export const transcription: TranscriptionAdapter = useMock ? mockTranscription : realStub;
export const llm: LlmAdapter = useMock ? mockLlm : realStub;
export const billing: BillingAdapter = useMock ? mockBilling : realStub;
export const booking: BookingAdapter = useMock ? mockBooking : realStub;
export const notify: NotifyAdapter = useMock ? mockNotify : realStub;

export const ADAPTER_MODE = useMock ? "mock" : "real";
export const IMAGE_PROVIDER = env.IMAGE_PROVIDER;
