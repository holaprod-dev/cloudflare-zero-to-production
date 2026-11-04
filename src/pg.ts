import { Client } from "pg";

export async function recentNotes(env: Env) {
  // Hyperdrive reuses connections: opening a client per request is fine.
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, title FROM notes ORDER BY created_at DESC LIMIT 20",
    );
    return rows;
  } finally {
    await client.end();
  }
}
