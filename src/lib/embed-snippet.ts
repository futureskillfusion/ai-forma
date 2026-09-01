import { env } from "./env";

/** The snippet a tenant pastes onto their own site (e.g. 3d-2u.com). */
export function embedSnippet(embedKey: string): string {
  const base = env.NEXT_PUBLIC_APP_URL;
  return `<!-- AI Forma widget -->
<div id="forma-intake"></div>
<script src="${base}/embed.js" data-forma-key="${embedKey}" async></script>`;
}

export function widgetUrl(embedKey: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/w/${embedKey}`;
}
