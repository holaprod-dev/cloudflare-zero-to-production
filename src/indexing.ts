const EMBEDDINGS = "@cf/baai/bge-m3";

export async function embed(env: Env, text: string) {
  const r = await env.AI.run(EMBEDDINGS, { text: [text] });
  // bge-m3 has several response shapes; with `text` it returns `data`.
  const vector = "data" in r ? r.data?.[0] : undefined;
  if (!vector) throw new Error("The model returned no vector");
  return vector;
}

export async function indexNote(
  env: Env,
  note: { id: number; userId: string; title: string; content: string },
) {
  const vector = await embed(env, `${note.title}\n${note.content}`);
  await env.VECTORS.upsert([
    {
      id: String(note.id),
      values: vector,
      metadata: { userId: note.userId },
    },
  ]);
}
