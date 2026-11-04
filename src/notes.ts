export interface Note {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

export async function listNotes(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      "SELECT id, title, content, created_at FROM notes " +
        "WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(userId)
    .all<Note>();
  return results;
}

export async function createNote(
  db: D1Database,
  userId: string,
  title: string,
  content: string,
) {
  return db
    .prepare(
      "INSERT INTO notes (user_id, title, content) " +
        "VALUES (?, ?, ?) RETURNING id",
    )
    .bind(userId, title, content)
    .first<{ id: number }>();
}
