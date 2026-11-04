const WIDTHS = new Set([200, 400, 800]);

export async function thumbnail(env: Env, key: string, width: number) {
  if (!WIDTHS.has(width)) {
    return new Response("Size not allowed", { status: 400 });
  }
  const original = await env.ATTACHMENTS.get(key);
  if (!original) return new Response("Not found", { status: 404 });

  const result = await env.IMAGES.input(original.body)
    .transform({ width, fit: "scale-down" })
    .output({ format: "image/avif", quality: 75 });

  const response = result.response();
  response.headers.set("Cache-Control", "public, max-age=86400");
  return response;
}
