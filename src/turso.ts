import { createClient } from "@libsql/client/web";

export function tursoClient(env: Env) {
  return createClient({ url: env.TURSO_URL, authToken: env.TURSO_TOKEN });
}

export async function countNotes(env: Env) {
  const r = await tursoClient(env).execute("SELECT COUNT(*) AS n FROM notes");
  return Number(r.rows[0]?.n ?? 0);
}
