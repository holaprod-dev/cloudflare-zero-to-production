import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  getQueueResult,
  introspectWorkflowInstance,
  waitOnExecutionContext,
} from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { processBatch, type AttachmentTask } from "../src/consumer";
import { incomingEmail } from "../src/incoming-email";
import { uploadUrl } from "../src/sign";
import { getAccessUser } from "../src/access";
import { isHuman } from "../src/turnstile";
import { withCache } from "../src/cache";
import { track } from "../src/metrics";
import { log } from "../src/log";

const url = (r: string) => `https://notes.test${r}`;
const request = (r: string, init?: RequestInit) => exports.default.fetch(url(r), init);

describe("ch. 3 · Workers", () => {
  it("greeting with a parameter and 404 as JSON", async () => {
    expect(await (await request("/api/hello/Ana")).json()).toEqual({ message: "Hello, Ana" });
    const r = await request("/api/does-not-exist");
    expect(r.status).toBe(404);
  });
});

describe("ch. 4 · Static Assets", () => {
  it("ASSETS returns index.html for any path (SPA mode)", async () => {
    const r = await env.ASSETS.fetch(url("/any/path"));
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("<title>Notes");
  });
  it("the ch. 4 catch-all turns a mistyped /api path into HTML 200", async () => {
    const r = await env.ASSETS.fetch(url("/api/notez"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
  });
  it("cache headers and Cache-Tag on /api/recent", async () => {
    const r = await request("/api/recent");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-tag")).toBe("recent");
    expect(r.headers.get("cache-control")).toContain("max-age=300");
  });
});

describe("ch. 5 · D1, KV and Durable Objects", () => {
  it("creates and lists notes in D1", async () => {
    const r = await request("/api/notes", { method: "POST" });
    expect(r.status).toBe(201);
    const { id } = await r.json<{ id: number }>();
    expect(id).toBeGreaterThan(0);
    const list = await (await request("/api/notes")).json<{ id: number; title: string }[]>();
    expect(list.map((n) => n.id)).toContain(id);
  });
  it("withCache computes once and then reads from KV", async () => {
    let calls = 0;
    const compute = async () => ({ n: ++calls });
    expect(await withCache(env.CONFIG, "k", 60, compute)).toEqual({ n: 1 });
    expect(await withCache(env.CONFIG, "k", 60, compute)).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });
  it("the room stores messages in its SQLite", async () => {
    const init = { method: "POST", body: JSON.stringify({ author: "ana", text: "hi" }) };
    expect((await request("/api/rooms/general/messages", init)).status).toBe(201);
    const m = await (await request("/api/rooms/general/messages")).json<{ author: string }[]>();
    expect(m[0]?.author).toBe("ana");
    const other = await (await request("/api/rooms/other/messages")).json<unknown[]>();
    expect(other).toHaveLength(0);
  });
});

describe("ch. 6 · R2", () => {
  it("uploads and downloads an attachment with its metadata", async () => {
    const upload = await request("/api/attachments/7/report.txt", {
      method: "PUT",
      body: "contents!",
      headers: { "content-type": "text/plain", "content-length": "9" },
    });
    expect(upload.status).toBe(201);
    const { key } = await upload.json<{ key: string }>();
    const download = await request(`/api/attachments/${key}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("text/plain");
    expect(download.headers.get("etag")).toBeTruthy();
    expect(await download.text()).toBe("contents!");
  });
  it("rejects empty uploads", async () => {
    const r = await request("/api/attachments/7/empty.txt", { method: "PUT", body: "" });
    expect(r.status).toBe(413);
  });
  it("signs a 10-minute upload URL", async () => {
    const u = new URL(await uploadUrl(env, "7/x"));
    expect(u.hostname).toBe("0123456789abcdef.r2.cloudflarestorage.com");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(u.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("ch. 7 · Background work", () => {
  it("enqueues a task", async () => {
    expect((await request("/api/attachments/3/process", { method: "POST" })).status).toBe(202);
  });
  it("the consumer acks the good ones and retries the broken ones", async () => {
    const batch = createMessageBatch<AttachmentTask>("process-attachments", [
      { id: "a", timestamp: new Date(), attempts: 1, body: { key: "3/ok", noteId: 3 } },
      { id: "b", timestamp: new Date(), attempts: 1, body: { key: "broken/1", noteId: 4 } },
    ]);
    const ctx = createExecutionContext();
    await processBatch(batch, env);
    const r = await getQueueResult(batch, ctx);
    expect(r.explicitAcks).toEqual(["a"]);
    expect(r.retryMessages).toEqual([{ msgId: "b" }]); // the helper does not keep delaySeconds
    expect(await env.CONFIG.get("processed:3/ok")).toBe("3");
  });
  it("the cron picks the task from the expression", async () => {
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ cron: "0 3 * * *" }), env, ctx);
    await waitOnExecutionContext(ctx);
    expect(await env.CONFIG.get("cron:cleanup")).toBeTruthy();
    expect(await env.CONFIG.get("cron:pending")).toBeNull();
  });
  it("the signup workflow finishes when there are notes", async () => {
    await env.DB.prepare(
      "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
    ).bind("u_9", "t", "c").run();
    const r = await request("/api/signup", {
      method: "POST",
      body: JSON.stringify({ userId: "u_9", email: "ana@example.com" }),
    });
    expect(r.status).toBe(202);
    const { id } = await r.json<{ id: string }>();
    await using instance = await introspectWorkflowInstance(env.SIGNUP_FLOW, id);
    await instance.modify(async (m) => {
      await m.disableSleeps();
    });
    await instance.waitForStatus("complete");
    expect(await instance.waitForStepResult({ name: "check activity" })).toBe(true);
  });
});

describe("ch. 8 · Email", () => {
  function email(from: string, subject: string) {
    const raw =
      `From: ${from}\r\nTo: notes@mydomain.dev\r\nSubject: ${subject}\r\n` +
      "Content-Type: text/plain; charset=utf-8\r\n\r\nText of the idea\r\n";
    const state = { rejected: "", forwarded: "" };
    const message = {
      from,
      to: "notes@mydomain.dev",
      headers: new Headers(),
      raw: new Response(raw).body!,
      rawSize: raw.length,
      setReject: (m: string) => void (state.rejected = m),
      forward: async (a: string) => void (state.forwarded = a),
      reply: async () => {},
    } as unknown as ForwardableEmailMessage;
    return { message, state };
  }
  it("saves an email from an allowed sender as a note", async () => {
    const { message, state } = email("you@gmail.com", "Idea by email");
    await incomingEmail(message, env);
    const row = await env.DB.prepare("SELECT content FROM notes WHERE title = ?")
      .bind("Idea by email")
      .first<{ content: string }>();
    expect(row?.content.trim()).toBe("Text of the idea");
    expect(state.forwarded).toBe("you@gmail.com");
  });
  it("rejects everyone else", async () => {
    const { message, state } = email("someone@example.com", "Spam");
    await incomingEmail(message, env);
    expect(state.rejected).toBe("Sender not allowed");
  });
});

describe("ch. 9 · Images", () => {
  // 2×2 pixel PNG
  const png = Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  ), (ch) => ch.charCodeAt(0));
  it("rejects widths that are not on the list", async () => {
    const r = await request("/api/thumbnail/1/photo?width=300");
    expect(r.status).toBe(400);
  });
  it("generates the AVIF thumbnail with a one-day cache", async () => {
    await env.ATTACHMENTS.put("1/photo", png, { httpMetadata: { contentType: "image/png" } });
    const r = await request("/api/thumbnail/1/photo?width=200");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/avif");
    expect(r.headers.get("cache-control")).toBe("public, max-age=86400");
  });
});

describe("ch. 11 · Security", () => {
  it("Turnstile: fails without a token, passes with the test key", async () => {
    expect(await isHuman(env, null, undefined)).toBe(false);
    expect(await isHuman(env, "XXXX.DUMMY.TOKEN.XXXX", "203.0.113.1")).toBe(true);
  });
  it("limits login to 5 attempts per minute and IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await request("/api/login", {
        method: "POST",
        headers: { "cf-connecting-ip": "198.51.100.7" },
      });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });
  it("Access: no header, no user", async () => {
    expect(await getAccessUser(new Request(url("/")), env)).toBeNull();
  });
});

describe("ch. 12 · Observability", () => {
  it("log and metrics do not throw", () => {
    expect(() => log("info", "test", { a: 1 })).not.toThrow();
    expect(() => track(env, "test", "u_1")).not.toThrow();
  });
});
