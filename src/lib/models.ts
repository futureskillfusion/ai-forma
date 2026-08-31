// Customer-selectable AI models shown in the intake widget.
// In this build every model is offered to every customer (mock adapters back
// them all). To gate by plan later, filter these lists server-side using the
// tenant's PlanLimit / feature flags before sending them to the widget.

export interface ModelOption {
  id: string;
  label: string;
  vendor: string;
  blurb: string;
}

export const IMAGE_MODELS: ModelOption[] = [
  { id: "flux-pro", label: "Flux 1.1 Pro", vendor: "Black Forest Labs", blurb: "Sharp product renders, strong prompt adherence" },
  { id: "dall-e-3", label: "DALL·E 3", vendor: "OpenAI", blurb: "Great with text + descriptive scenes" },
  { id: "imagen-3", label: "Imagen 3", vendor: "Google", blurb: "Photorealistic, clean materials" },
  { id: "midjourney-v6", label: "Midjourney v6", vendor: "Midjourney", blurb: "Most stylised / concept-art feel" },
  { id: "sd-3-5-large", label: "Stable Diffusion 3.5 Large", vendor: "Stability AI", blurb: "Open model, fast + tunable" },
  { id: "gpt-image-1", label: "GPT Image 1", vendor: "OpenAI", blurb: "Balanced quality, good for iteration" },
];

export const LLM_MODELS: ModelOption[] = [
  { id: "claude-opus", label: "Claude Opus", vendor: "Anthropic", blurb: "Most capable — best for nuanced briefs" },
  { id: "claude-sonnet", label: "Claude Sonnet", vendor: "Anthropic", blurb: "Fast + strong — the default" },
  { id: "gpt-4o", label: "GPT-4o", vendor: "OpenAI", blurb: "Broad general reasoning" },
  { id: "gemini-1-5-pro", label: "Gemini 1.5 Pro", vendor: "Google", blurb: "Long context, good vision" },
  { id: "llama-3-1-70b", label: "Llama 3.1 70B", vendor: "Meta", blurb: "Open model, cost-efficient" },
];

export const DEFAULT_IMAGE_MODEL = "flux-pro";
export const DEFAULT_LLM_MODEL = "claude-sonnet";

const imageIds = new Set(IMAGE_MODELS.map((m) => m.id));
const llmIds = new Set(LLM_MODELS.map((m) => m.id));

export const isImageModel = (id: string | null | undefined): boolean => !!id && imageIds.has(id);
export const isLlmModel = (id: string | null | undefined): boolean => !!id && llmIds.has(id);

export const imageModelLabel = (id: string | null | undefined): string =>
  IMAGE_MODELS.find((m) => m.id === id)?.label ?? id ?? "—";
export const llmModelLabel = (id: string | null | undefined): string =>
  LLM_MODELS.find((m) => m.id === id)?.label ?? id ?? "—";
