import { z } from "zod";
import { HttpError } from "./rbac";

/** Parse+validate a JSON body, throwing a 400 HttpError with field details. */
export async function readJson<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    throw new HttpError(400, first ? `${first.path.join(".")}: ${first.message}` : "Invalid request body");
  }
  return parsed.data;
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}
