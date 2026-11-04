/// <reference types="@cloudflare/vitest-plugin/types" />
declare namespace Cloudflare {
  interface Env {
    MIGRATIONS: import("cloudflare:test").D1Migration[];
  }
}
