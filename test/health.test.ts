import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("API", () => {
  it("responds on /api/health", async () => {
    const res = await exports.default.fetch("https://notes.test/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
