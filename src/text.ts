import type { AttachmentTask } from "./consumer";
// Test stand-in for your processing logic: it fails for "broken/…" keys
// so the queue retries can be tested.
export async function extractText(env: Env, task: AttachmentTask) {
  if (task.key.startsWith("broken/")) throw new Error("broken attachment");
  await env.CONFIG.put(`processed:${task.key}`, String(task.noteId));
}
