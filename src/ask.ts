import { embed } from "./indexing";

export async function ask(env: Env, userId: string, question: string) {
  const vector = await embed(env, question);
  const { matches } = await env.VECTORS.query(vector, {
    topK: 5,
    filter: { userId },
  });

  const ids = matches.map((m) => Number(m.id));
  if (ids.length === 0) return "I couldn't find any notes about that.";

  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB
    .prepare(`SELECT title, content FROM notes WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ title: string; content: string }>();

  const context = results
    .map((n) => `## ${n.title}\n${n.content}`)
    .join("\n\n");

  const r = await env.AI.run(
    "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
    {
      messages: [
        {
          role: "system",
          content:
            "Answer in the user's language using only these notes. " +
            "If the answer isn't in them, say so.\n\n" + context,
        },
        { role: "user", content: question },
      ],
      max_tokens: 400,
    },
    { gateway: { id: "notes" } },
  );
  return r.response;
}
