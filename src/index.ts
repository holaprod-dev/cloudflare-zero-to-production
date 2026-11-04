// Puts the routes and handlers from every chapter of the guide into a single Worker,
// so tsc and the tests in test/ can check them all.
import { Hono } from "hono";
import { cache } from "cloudflare:workers";
import { attachments } from "./attachments";
import { createNote, listNotes } from "./notes";
import { incomingEmail } from "./incoming-email";
import { processBatch, type AttachmentTask } from "./consumer";
import { isHuman } from "./turnstile";
import { getAccessUser } from "./access";
import { log } from "./log";
import { track } from "./metrics";
import { thumbnail } from "./thumbnails";
import { withCache } from "./cache";
import { uploadUrl } from "./sign";
import { countNotes } from "./turso";
import { trackEvent, cleanUpTempFiles, enqueuePending } from "./support";

export { Room } from "./room";
export { SignupFlow } from "./signup-flow";
import type { Signup } from "./signup-flow";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/hello/:name", (c) => {
  const name = c.req.param("name");
  return c.json({ message: `Hello, ${name}` });
});

app.get("/api/notes", async (c) => {
  return c.json(await listNotes(c.env.DB, "u_1"));
});

app.post("/api/notes", async (c) => {
  const note = await createNote(c.env.DB, "u_1", "Title", "Text");
  c.executionCtx.waitUntil(trackEvent(c.env, "note_created"));
  if (note) log("info", "note_created", { userId: "u_1", noteId: note.id });
  track(c.env, "note_created", "u_1");
  return c.json(note, 201);
});

app.get("/api/recent", async (c) => {
  const { results } = await c.env.DB
    .prepare("SELECT id, title FROM notes ORDER BY created_at DESC LIMIT 10")
    .all();
  return c.json(results, 200, {
    "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
    "Cache-Tag": "recent",
  });
});

app.post("/api/recent/purge", async (c) => {
  const r = await cache.purge({ tags: ["recent"] });
  return c.json(r);
  return c.json({ ok: true });
});

app.get("/api/config/:key", async (c) => {
  const value = await withCache(c.env.CONFIG, c.req.param("key"), 60, async () => ({
    computedAt: Date.now(),
  }));
  return c.json(value);
});

app.post("/api/rooms/:id/messages", async (c) => {
  const room = c.env.ROOMS.getByName(c.req.param("id"));
  const { author, text } = await c.req.json<{ author: string; text: string }>();
  await room.post(author, text);
  return c.json({ ok: true }, 201);
});

app.get("/api/rooms/:id/messages", async (c) => {
  const room = c.env.ROOMS.getByName(c.req.param("id"));
  return c.json(await room.latest());
});

app.post("/api/attachments/:noteId/process", async (c) => {
  const key = `${c.req.param("noteId")}/x`;
  const noteId = Number(c.req.param("noteId"));
  await c.env.ATTACHMENTS_QUEUE.send({ key, noteId } satisfies AttachmentTask);
  return c.json({ ok: true }, 202);
});

app.get("/api/sign/:key", async (c) => c.json({ url: await uploadUrl(c.env, c.req.param("key")) }));

app.get("/api/thumbnail/:noteId/:id", (c) =>
  thumbnail(c.env, `${c.req.param("noteId")}/${c.req.param("id")}`, Number(c.req.query("width"))),
);

app.post("/api/signup", async (c) => {
  const { userId, email } = await c.req.json<Signup>();
  const instance = await c.env.SIGNUP_FLOW.create({
    params: { userId, email },
  });
  return c.json({ id: instance.id }, 202);
});

app.post("/api/signup-form", async (c) => {
  const form = await c.req.formData();
  const token = form.get("cf-turnstile-response");
  const ok = await isHuman(
    c.env,
    typeof token === "string" ? token : null,
    c.req.header("cf-connecting-ip"),
  );
  if (!ok) return c.json({ error: "We couldn't verify you" }, 400);
  return c.json({ ok: true }, 201);
});

app.post("/api/login", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.LOGIN_LIMITER.limit({ key: ip });
  if (!success) {
    return c.json({ error: "Too many attempts. Wait a minute." }, 429);
  }
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => c.json({ email: await getAccessUser(c.req.raw, c.env) }));

app.get("/api/turso/notes", async (c) => c.json({ n: await countNotes(c.env) }));

app.route("/api/attachments", attachments);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    switch (event.cron) {
      case "0 3 * * *":
        await cleanUpTempFiles(env);
        break;
      case "*/15 * * * *":
        await enqueuePending(env);
        break;
    }
  },
  queue: processBatch,
  email: incomingEmail,
} satisfies ExportedHandler<Env, AttachmentTask>;
