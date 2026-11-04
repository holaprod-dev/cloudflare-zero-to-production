import { DurableObject } from "cloudflare:workers";

export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
  }

  async post(author: string, text: string) {
    this.ctx.storage.sql.exec(
      "INSERT INTO messages (author, text) VALUES (?, ?)",
      author,
      text,
    );
  }

  async latest(limit = 20) {
    return this.ctx.storage.sql
      .exec("SELECT author, text, created_at FROM messages ORDER BY id DESC LIMIT ?", limit)
      .toArray();
  }
}
