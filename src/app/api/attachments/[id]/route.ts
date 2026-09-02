import { db } from "@/lib/db";

// Public read of one attachment by its (unguessable) id — needed so external
// image providers (img2img) can fetch a customer's uploaded reference. Only the
// raw bytes are served; ids are UUIDs and never listed publicly.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const att = await db.attachment.findUnique({
    where: { id },
    select: { url: true, mimeType: true },
  });
  if (!att) return new Response("Not found", { status: 404 });

  const m = att.url.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) {
    // Already a URL (prod object storage) — just redirect.
    return Response.redirect(att.url, 302);
  }
  const bytes = Buffer.from(m[2], "base64");
  return new Response(bytes, {
    headers: {
      "content-type": att.mimeType || m[1] || "application/octet-stream",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
