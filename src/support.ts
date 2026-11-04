// Functions the guide leaves to each project. Here they only leave a trace in KV
// so the tests can check they were called.
export async function trackEvent(env: Env, event: string) {
  await env.CONFIG.put(`event:${event}`, String(Date.now()));
}
export async function cleanUpTempFiles(env: Env) {
  await env.CONFIG.put("cron:cleanup", String(Date.now()));
}
export async function enqueuePending(env: Env) {
  await env.CONFIG.put("cron:pending", String(Date.now()));
}
