import { Hono } from "hono";

export const attachments = new Hono<{ Bindings: Env }>();

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

attachments.put("/:noteId/:name", async (c) => {
  const size = Number(c.req.header("content-length") ?? 0);
  if (!size || size > MAX_BYTES) {
    return c.json({ error: "File is empty or too large" }, 413);
  }
  const key = `${c.req.param("noteId")}/${crypto.randomUUID()}`;
  await c.env.ATTACHMENTS.put(key, c.req.raw.body, {
    httpMetadata: {
      contentType: c.req.header("content-type") ?? "application/octet-stream",
    },
    customMetadata: { name: c.req.param("name") },
  });
  return c.json({ key }, 201);
});

attachments.get("/:noteId/:id", async (c) => {
  const key = `${c.req.param("noteId")}/${c.req.param("id")}`;
  const object = await c.env.ATTACHMENTS.get(key);
  if (!object) return c.json({ error: "Not found" }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
});
