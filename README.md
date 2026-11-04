# Cloudflare from zero to production · code

This is the code for the guide [Cloudflare de cero a producción](https://holaprod.dev/guias/cloudflare-de-cero-a-produccion) (in Spanish, on holaprod.dev): a notes app in a single Worker with TypeScript 7. The files in `src/` are the same ones shown in the chapters. `src/index.ts` puts them together so they can all be checked at once.

Tested on 2026-11-04 with TypeScript 7.0.2, Wrangler 4.157 and Vitest 5.1 (`@cloudflare/vitest-plugin` 1.5.1), always **locally**: it doesn't create or use resources in any account.

## How to try it

```bash
npm install
cp .dev.vars.example .dev.vars   # test values, not real secrets
npm run check                    # wrangler types + tsc
npm test                         # tests inside workerd
npm run bundle                   # bundles the Worker without deploying
```

## What the tests cover

| Chapter | What `test/guide.test.ts` checks |
|---|---|
| 3 · Workers | Routes with Hono and 404 as JSON |
| 4 · Static Assets | SPA mode, cache headers and `Cache-Tag` |
| 5 · Databases | Migrations and queries in D1, cache in KV, a Durable Object's SQLite |
| 6 · R2 | Upload and download with metadata, size limit, signed URL |
| 7 · Background work | Queue (ack and retry), cron and a full Workflow |
| 8 · Email | Incoming email with postal-mime; sending with the local binding |
| 9 · Images | AVIF thumbnail with the Images binding |
| 11 · Security | Turnstile with the test key, login rate limiting, Access |
| 12 · Observability | Structured logs and Analytics Engine |

## Still to test against an account

What can't be simulated locally is only checked with `tsc` and when bundling:

- Workers AI and Vectorize (chapter 10).
- Hyperdrive with a real Postgres and Turso with a real database (chapter 5).
- `cache.purge`.
- A valid Access JWT.
- Workers Previews and deploying from GitHub Actions (chapter 14).

## Notes

- `src/support.ts` and `src/text.ts` stand in for functions the guide leaves to each project. They're only there so the tests pass.
- The ids in `wrangler.jsonc` are examples. To deploy, create your resources and use the ids the commands give you back.
- `TURNSTILE_SECRET` in `.dev.vars.example` is Cloudflare's public test secret key, the one that always passes.
- This repository is published from [holaprod.dev](https://holaprod.dev)'s own repository. Issues and pull requests are welcome; changes are applied there and published here again.
